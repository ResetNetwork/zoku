import { Hono } from 'hono';
import type { Bindings, Zoku } from '../types';
import { DB } from '../db';
import { encryptJewel } from '../lib/crypto';
import { requireTier } from '../middleware/auth';
import { validateBody } from '../lib/errors';
import { updateSourceSchema } from '../lib/validation';
import { NotFoundError } from '../lib/errors';

const app = new Hono<{ Bindings: Bindings }>();

// Get source details
app.get('/:id', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const source = await db.getSource(id);
  if (!source) {
    throw new NotFoundError('Source', id);
  }

  // Don't expose jewels
  return c.json({
    id: source.id,
    entanglement_id: source.entanglement_id,
    type: source.type,
    config: source.config,
    enabled: source.enabled,
    last_sync: source.last_sync,
    created_at: source.created_at
  });
});

// Update source (Entangled and Prime only)
app.patch('/:id', requireTier('entangled'), async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');
  const body = await validateBody(c, updateSourceSchema);

  const source = await db.getSource(id);
  if (!source) {
    throw new NotFoundError('Source', id);
  }

  // If updating jewels, encrypt them
  let jewels = body.credentials;
  if (jewels && c.env.ENCRYPTION_KEY) {
    jewels = await encryptJewel(JSON.stringify(jewels), c.env.ENCRYPTION_KEY);
  }

  await db.updateSource(id, {
    config: body.config,
    jewels: jewels ? { encrypted: jewels } : undefined,
    enabled: body.enabled
  });

  return c.json({ success: true });
});

// Delete source (Entangled and Prime only)
app.delete('/:id', requireTier('entangled'), async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const source = await db.getSource(id);
  if (!source) {
    throw new NotFoundError('Source', id);
  }

  await db.deleteSource(id);
  return c.json({ success: true });
});

// Trigger manual sync (Entangled and Prime only)
app.post('/:id/sync', requireTier('entangled'), async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const source = await db.getSource(id);
  if (!source) {
    throw new NotFoundError('Source', id);
  }

  // Import sync dependencies
  const { handlers } = await import('../handlers');
  const { decryptJewel } = await import('../lib/crypto');

  const handler = handlers[source.type];
  if (!handler) {
    return c.json({
      error: { code: 'NO_HANDLER', message: `No handler for source type: ${source.type}` }
    }, 400);
  }

  try {
    const config = JSON.parse(source.config);

    // Get jewels
    let credentials = {};
    if (source.jewel_id) {
      const jewel = await db.getJewel(source.jewel_id);
      if (!jewel) {
        return c.json({
          error: { code: 'JEWEL_NOT_FOUND', message: 'Jewel not found' }
        }, 404);
      }
      credentials = JSON.parse(await decryptJewel(jewel.data, c.env.ENCRYPTION_KEY));
    } else if (source.credentials) {
      credentials = JSON.parse(await decryptJewel(source.credentials, c.env.ENCRYPTION_KEY));
    }

    // Fetch new activity
    const { qupts, cursor } = await handler.collect({
      source,
      config,
      credentials,
      since: source.last_sync,
      cursor: source.sync_cursor
    });

    // Insert qupts
    if (qupts.length > 0) {
      await db.batchCreateQupts(qupts);
    }

    // Update sync state - clear errors on success
    await db.updateSource(source.id, {
      last_sync: Math.floor(Date.now() / 1000),
      sync_cursor: cursor,
      last_error: null,
      error_count: 0,
      last_error_at: null
    });

    return c.json({
      success: true,
      qupts_collected: qupts.length,
      message: `Collected ${qupts.length} item${qupts.length === 1 ? '' : 's'}`
    });

  } catch (error) {
    console.error(`❌ Manual sync failed for source ${source.id}:`, error);

    // Track error with user-friendly message
    let errorMessage = error instanceof Error ? error.message : String(error);
    const currentErrorCount = source.error_count || 0;

    // Clean up Google Docs errors to be user-friendly
    if (errorMessage.includes('403') && errorMessage.includes('does not have permission')) {
      // Get email from jewel for helpful message
      let accountEmail = 'your account';
      if (source.jewel_id) {
        const jewel = await db.getJewel(source.jewel_id);
        if (jewel && jewel.validation_metadata) {
          try {
            const metadata = JSON.parse(jewel.validation_metadata);
            accountEmail = metadata.email || metadata.authenticated_as || 'your account';
          } catch (e) {
            // Use default
          }
        }
      }
      errorMessage = `Access denied. Add ${accountEmail} to the file/folder`;
    }

    console.log(`💾 Storing error in database: "${errorMessage}"`);
    console.log(`📊 Error count: ${currentErrorCount} → ${currentErrorCount + 1}`);

    try {
      await db.updateSource(source.id, {
        last_error: errorMessage,
        error_count: currentErrorCount + 1,
        last_error_at: Math.floor(Date.now() / 1000)
      });
      console.log('✅ Error stored successfully');
    } catch (dbError) {
      console.error('❌ Failed to store error in database:', dbError);
    }

    return c.json({
      error: {
        code: 'SYNC_FAILED',
        message: errorMessage
      }
    }, 500);
  }
});

export default app;
