// Jewels API routes
import { Hono } from 'hono';
import { DB } from '../db';
import type { Bindings, Zoku } from '../types';
import { encryptJewel, decryptJewel } from '../lib/crypto';
import { validateGitHubCredential, validateZammadCredential, validateGoogleDocsCredential } from '../handlers/validate';
import { requireTier } from '../middleware/auth';

const app = new Hono<{ Bindings: Bindings }>();

// List jewels (filter by ownership, hide others' encrypted data)
app.get('/', async (c) => {
  const user = c.get('user') as Zoku;
  const db = new DB(c.env.DB);
  const type = c.req.query('type');
  const limit = c.req.query('limit');

  const jewels = await db.listJewels({
    type: type || undefined,
    limit: limit ? parseInt(limit) : undefined
  });

  // Filter encrypted data for jewels owned by others
  const sanitized = jewels.map(jewel => {
    const isOwner = jewel.owner_id === user.id;
    const isPrime = user.access_tier === 'prime';

    if (!isOwner && !isPrime) {
      // Non-owners can see metadata but not data
      return {
        id: jewel.id,
        name: jewel.name,
        type: jewel.type,
        owner_id: jewel.owner_id,
        last_validated: jewel.last_validated,
        validation_metadata: jewel.validation_metadata ? JSON.parse(jewel.validation_metadata) : null,
        created_at: jewel.created_at,
        updated_at: jewel.updated_at,
        data: '[REDACTED - owned by another user]'
      };
    }

    // Owners and Prime can see full metadata (but still not the encrypted data)
    return {
      id: jewel.id,
      name: jewel.name,
      type: jewel.type,
      owner_id: jewel.owner_id,
      last_validated: jewel.last_validated,
      validation_metadata: jewel.validation_metadata ? JSON.parse(jewel.validation_metadata) : null,
      created_at: jewel.created_at,
      updated_at: jewel.updated_at
    };
  });

  return c.json({ jewels: sanitized });
});

// Create jewel with validation (auto-assign owner)
app.post('/', requireTier('coherent'), async (c) => {
  const user = c.get('user') as Zoku;
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

  // Validate jewel before storing
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
            message: 'Jewel validation failed',
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
    warnings.push('Could not validate jewel, but storing anyway');
  }

  // Encrypt jewel
  const encrypted = await encryptJewel(JSON.stringify(body.data), c.env.ENCRYPTION_KEY);

  // Store jewel with owner auto-assigned
  const jewel = await db.createJewel({
    name: body.name,
    type: body.type,
    data: encrypted,
    owner_id: user.id,  // Auto-assign owner
    last_validated: Math.floor(Date.now() / 1000),
    validation_metadata: validationMetadata
  });

  // Audit log
  await db.createAuditLog({
    zoku_id: user.id,
    action: 'create',
    resource_type: 'jewel',
    resource_id: jewel.id,
    request_id: c.get('requestId')
  });

  // Return without encrypted data
  const response: any = {
    id: jewel.id,
    name: jewel.name,
    type: jewel.type,
    last_validated: jewel.last_validated,
    validation: validationMetadata,
    created_at: jewel.created_at,
    updated_at: jewel.updated_at
  };

  if (warnings.length > 0) {
    response.warnings = warnings;
  }

  return c.json(response, 201);
});

// Get single jewel (without encrypted data)
app.get('/:id', async (c) => {
  const user = c.get('user') as Zoku;
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const jewel = await db.getJewel(id);
  if (!jewel) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Jewel not found' } }, 404);
  }

  return c.json({
    id: jewel.id,
    name: jewel.name,
    type: jewel.type,
    owner_id: jewel.owner_id,
    last_validated: jewel.last_validated,
    validation_metadata: jewel.validation_metadata ? JSON.parse(jewel.validation_metadata) : null,
    created_at: jewel.created_at,
    updated_at: jewel.updated_at
  });
});

// Update jewel (must own it, unless Prime)
app.patch('/:id', requireTier('coherent'), async (c) => {
  const user = c.get('user') as Zoku;
  const db = new DB(c.env.DB);
  const id = c.req.param('id');
  const body = await c.req.json();

  const jewel = await db.getJewel(id);
  if (!jewel) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Jewel not found' } }, 404);
  }

  // Check ownership
  if (jewel.owner_id !== user.id && user.access_tier !== 'prime') {
    return c.json({ error: 'Can only update your own jewels' }, 403);
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

      switch (jewel.type) {
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
              message: 'Jewel validation failed',
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

    const encrypted = await encryptJewel(JSON.stringify(body.data), c.env.ENCRYPTION_KEY);
    updates.data = encrypted;
    updates.last_validated = Math.floor(Date.now() / 1000);
    // Store as object, not stringified - DB layer handles serialization
    updates.validation_metadata = validationMetadata;

    console.log('💾 Saving validation metadata:', validationMetadata);
  }

  await db.updateJewel(id, updates);

  return c.json({ success: true });
});

// Re-authorize Google jewel (uses existing client_id/secret)
app.post('/:id/reauthorize', requireTier('coherent'), async (c) => {
  const user = c.get('user') as Zoku;
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const jewel = await db.getJewel(id);
  if (!jewel) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Jewel not found' } }, 404);
  }

  // Check ownership
  if (jewel.owner_id !== user.id && user.access_tier !== 'prime') {
    return c.json({ error: 'Can only reauthorize your own jewels' }, 403);
  }

  if (jewel.type !== 'gdrive') {
    return c.json({
      error: { code: 'INVALID_TYPE', message: 'Re-authorization only supported for Google Drive jewels' }
    }, 400);
  }

  // Decrypt existing jewel to get client_id/secret
  const decrypted = JSON.parse(await decryptJewel(jewel.data, c.env.ENCRYPTION_KEY));

  // Generate OAuth URL using existing jewel data
  const state = JSON.stringify({
    nonce: crypto.randomUUID(),
    client_id: decrypted.client_id,
    client_secret: decrypted.client_secret,
    jewel_id: id  // Track which jewel this is for
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

// Delete jewel (must own it, unless Prime)
app.delete('/:id', requireTier('coherent'), async (c) => {
  const user = c.get('user') as Zoku;
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const jewel = await db.getJewel(id);
  if (!jewel) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Jewel not found' } }, 404);
  }

  // Check ownership or Prime permission
  if (jewel.owner_id !== user.id && user.access_tier !== 'prime') {
    return c.json({ error: 'Can only delete your own jewels' }, 403);
  }

  // Check if jewel is in use
  const usage = await db.getJewelUsage(id);
  if (usage.length > 0) {
    return c.json({
      error: {
        code: 'JEWEL_IN_USE',
        message: `Cannot delete jewel: used by ${usage.length} source(s)`,
        usage: usage
      }
    }, 400);
  }

  await db.deleteJewel(id);

  // Audit log
  await db.createAuditLog({
    zoku_id: user.id,
    action: 'delete',
    resource_type: 'jewel',
    resource_id: id,
    request_id: c.get('requestId')
  });

  return c.json({ success: true });
});

// Get jewel usage
app.get('/:id/usage', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const jewel = await db.getJewel(id);
  if (!jewel) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Jewel not found' } }, 404);
  }

  const usage = await db.getJewelUsage(id);
  return c.json({ usage });
});

export default app;
