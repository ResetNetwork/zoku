// Credentials API routes
import { Hono } from 'hono';
import { DB } from '../db';
import type { Bindings } from '../types';
import { encryptCredentials, decryptCredentials } from '../lib/crypto';
import { validateGitHubCredential, validateZammadSource, validateGoogleDocsSource } from '../handlers/validate';

const app = new Hono<{ Bindings: Bindings }>();

// List credentials (without exposing encrypted data)
app.get('/', async (c) => {
  const db = new DB(c.env.DB);
  const type = c.req.query('type');
  const limit = c.req.query('limit');

  const credentials = await db.listCredentials({
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

  return c.json({ credentials: sanitized });
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
        validationResult = await validateZammadSource({}, body.data);
        break;
      case 'gdocs':
        validationResult = await validateGoogleDocsSource({ document_id: body.data.test_document_id || '' }, body.data);
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
  const credential = await db.createCredential({
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
    return c.json({ error: { code: 'NOT_FOUND', message: 'Credential not found' } }, 404);
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
    return c.json({ error: { code: 'NOT_FOUND', message: 'Credential not found' } }, 404);
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
          validationResult = await validateZammadSource({}, body.data);
          break;
        case 'gdocs':
          validationResult = await validateGoogleDocsSource({ document_id: body.data.test_document_id || '' }, body.data);
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
    updates.validation_metadata = validationMetadata;
  }

  await db.updateCredential(id, updates);

  return c.json({ success: true });
});

// Delete credential
app.delete('/:id', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const credential = await db.getCredential(id);
  if (!credential) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Credential not found' } }, 404);
  }

  // Check if credential is in use
  const usage = await db.getCredentialUsage(id);
  if (usage.length > 0) {
    return c.json({
      error: {
        code: 'CREDENTIAL_IN_USE',
        message: `Cannot delete credential: used by ${usage.length} source(s)`,
        usage: usage
      }
    }, 400);
  }

  await db.deleteCredential(id);
  return c.json({ success: true });
});

// Get credential usage
app.get('/:id/usage', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const credential = await db.getCredential(id);
  if (!credential) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Credential not found' } }, 404);
  }

  const usage = await db.getCredentialUsage(id);
  return c.json({ usage });
});

export default app;
