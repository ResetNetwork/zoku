// Credentials API routes
import { Hono } from 'hono';
import { DB } from '../db';
import type { Bindings } from '../types';
import { encryptCredentials, decryptCredentials } from '../lib/crypto';
import { validateGitHubCredential, validateZammadCredential, validateGoogleDocsCredential } from '../handlers/validate';

const app = new Hono<{ Bindings: Bindings }>();

// List credentials (without exposing encrypted data)
app.get('/', async (c) => {
  const db = new DB(c.env.DB);
  const type = c.req.query('type');
  const limit = c.req.query('limit');

  const credentials = await db.listJewels({
    type: type || undefined,
    limit: limit ? parseInt(limit) : undefined
  });

  // Remove encrypted data from response
  const sanitized = credentials.map(cred => ({
    id: cred.id,
    name: cred.name,
    type: cred.type,
    last_validated: cred.last_validated,
    validation_metadata: cred.validation_metadata ? JSON.parse(cred.validation_metadata) : null,
    created_at: cred.created_at,
    updated_at: cred.updated_at
  }));

  return c.json({jewels: sanitized });
});

// Create credential with validation
app.post('/', async (c) => {
  const db = new DB(c.env.DB);
  const body = await c.req.json();

  if (!body.name || !body.type || !body.data) {
    return c.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'name, type, and data are required'
      }
    }, 400);
  }

  // Validate credentials before storing
  const warnings: string[] = [];
  let validationMetadata: Record<string, any> = {};

  try {
    let validationResult;

    switch (body.type) {
      case 'github':
        validationResult = await validateGitHubCredential(body.data);
        break;
      case 'zammad':
        validationResult = await validateZammadCredential(body.data);
        break;
      case 'gdrive':
        validationResult = await validateGoogleDocsCredential(
          body.data,
          body.data.client_id,
          body.data.client_secret
        );
        break;
      default:
        // Other types don't have validation yet
        break;
    }

    if (validationResult) {
      if (!validationResult.valid) {
        return c.json({
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Credential validation failed',
            errors: validationResult.errors,
            warnings: validationResult.warnings
          }
        }, 400);
      }

      warnings.push(...validationResult.warnings);
      validationMetadata = validationResult.metadata || {};
    }
  } catch (error) {
    console.error('Validation error:', error);
    warnings.push('Could not validate credentials, but storing anyway');
  }

  // Encrypt credentials
  const encrypted = await encryptCredentials(JSON.stringify(body.data), c.env.ENCRYPTION_KEY);

  // Store credential
  const credential = await db.createJewel({
    name: body.name,
    type: body.type,
    data: encrypted,
    last_validated: Math.floor(Date.now() / 1000),
    validation_metadata: validationMetadata
  });

  // Return without encrypted data
  const response: any = {
    id: credential.id,
    name: credential.name,
    type: credential.type,
    last_validated: credential.last_validated,
    validation: validationMetadata,
    created_at: credential.created_at,
    updated_at: credential.updated_at
  };

  if (warnings.length > 0) {
    response.warnings = warnings;
  }

  return c.json(response, 201);
});

// Get single credential (without encrypted data)
app.get('/:id', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const credential = await db.getCredential(id);
  if (!credential) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Jewel not found' } }, 404);
  }

  return c.json({
    id: credential.id,
    name: credential.name,
    type: credential.type,
    last_validated: credential.last_validated,
    validation_metadata: credential.validation_metadata ? JSON.parse(credential.validation_metadata) : null,
    created_at: credential.created_at,
    updated_at: credential.updated_at
  });
});

// Update credential
app.patch('/:id', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');
  const body = await c.req.json();

  const credential = await db.getCredential(id);
  if (!credential) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Jewel not found' } }, 404);
  }

  const updates: any = {};

  if (body.name) {
    updates.name = body.name;
  }

  // If updating data, re-validate and encrypt
  if (body.data) {
    const warnings: string[] = [];
    let validationMetadata: Record<string, any> = {};

    try {
      let validationResult;

      switch (credential.type) {
        case 'github':
          validationResult = await validateGitHubCredential(body.data);
          break;
        case 'zammad':
          validationResult = await validateZammadCredential(body.data);
          break;
        case 'gdrive':
          validationResult = await validateGoogleDocsCredential(
            body.data,
            body.data.client_id,
            body.data.client_secret
          );
          break;
      }

      if (validationResult) {
        if (!validationResult.valid) {
          return c.json({
            error: {
              code: 'VALIDATION_FAILED',
              message: 'Credential validation failed',
              errors: validationResult.errors,
              warnings: validationResult.warnings
            }
          }, 400);
        }

        warnings.push(...validationResult.warnings);
        validationMetadata = validationResult.metadata || {};
      }
    } catch (error) {
      console.error('Validation error:', error);
    }

    const encrypted = await encryptCredentials(JSON.stringify(body.data), c.env.ENCRYPTION_KEY);
    updates.data = encrypted;
    updates.last_validated = Math.floor(Date.now() / 1000);
    // Store as object, not stringified - DB layer handles serialization
    updates.validation_metadata = validationMetadata;

    console.log('💾 Saving validation metadata:', validationMetadata);
  }

  await db.updateJewel(id, updates);

  return c.json({ success: true });
});

// Re-authorize Google credential (uses existing client_id/secret)
app.post('/:id/reauthorize', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const credential = await db.getCredential(id);
  if (!credential) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Jewel not found' } }, 404);
  }

  if (credential.type !== 'gdrive') {
    return c.json({
      error: { code: 'INVALID_TYPE', message: 'Re-authorization only supported for Google Drive credentials' }
    }, 400);
  }

  // Decrypt existing credential to get client_id/secret
  const decrypted = JSON.parse(await decryptCredentials(credential.data, c.env.ENCRYPTION_KEY));

  // Generate OAuth URL using existing credentials
  const state = JSON.stringify({
    nonce: crypto.randomUUID(),
    client_id: decrypted.client_id,
    client_secret: decrypted.client_secret,
    jewel_id: id  // Track which credential this is for
  });

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', decrypted.client_id);
  authUrl.searchParams.set('redirect_uri', `${new URL(c.req.url).origin}/api/oauth/google/callback`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/documents.readonly');
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', btoa(state));

  return c.json({
    authorization_url: authUrl.toString(),
    state: btoa(state)
  });
});

// Delete credential
app.delete('/:id', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const credential = await db.getCredential(id);
  if (!credential) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Jewel not found' } }, 404);
  }

  // Check if credential is in use
  const usage = await db.getJewelUsage(id);
  if (usage.length > 0) {
    return c.json({
      error: {
        code: 'CREDENTIAL_IN_USE',
        message: `Cannot delete credential: used by ${usage.length} source(s)`,
        usage: usage
      }
    }, 400);
  }

  await db.deleteJewel(id);
  return c.json({ success: true });
});

// Get credential usage
app.get('/:id/usage', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const credential = await db.getCredential(id);
  if (!credential) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Jewel not found' } }, 404);
  }

  const usage = await db.getJewelUsage(id);
  return c.json({ usage });
});

export default app;
