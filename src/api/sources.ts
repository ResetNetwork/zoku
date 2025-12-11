import { Hono } from 'hono';
import type { Bindings } from '../types';
import { DB } from '../db';
import { encryptCredentials } from '../lib/crypto';

const app = new Hono<{ Bindings: Bindings }>();

// Get source details
app.get('/:id', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const source = await db.getSource(id);
  if (!source) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Source not found' } }, 404);
  }

  // Don't expose credentials
  return c.json({
    id: source.id,
    volition_id: source.volition_id,
    type: source.type,
    config: source.config,
    enabled: source.enabled,
    last_sync: source.last_sync,
    created_at: source.created_at
  });
});

// Update source
app.patch('/:id', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');
  const body = await c.req.json();

  const source = await db.getSource(id);
  if (!source) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Source not found' } }, 404);
  }

  // If updating credentials, encrypt them
  let credentials = body.credentials;
  if (credentials && c.env.ENCRYPTION_KEY) {
    credentials = await encryptCredentials(JSON.stringify(credentials), c.env.ENCRYPTION_KEY);
  }

  await db.updateSource(id, {
    config: body.config,
    credentials: credentials ? { encrypted: credentials } : undefined,
    enabled: body.enabled
  });

  return c.json({ success: true });
});

// Delete source
app.delete('/:id', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const source = await db.getSource(id);
  if (!source) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Source not found' } }, 404);
  }

  await db.deleteSource(id);
  return c.json({ success: true });
});

// Trigger manual sync
app.post('/:id/sync', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const source = await db.getSource(id);
  if (!source) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Source not found' } }, 404);
  }

  // TODO: Trigger sync handler
  // For now, just return success
  return c.json({ success: true, message: 'Sync triggered (not yet implemented)' });
});

export default app;
