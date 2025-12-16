import { Hono } from 'hono';
import type { Bindings, Zoku } from '../types';
import { DB } from '../db';
import { requireTier } from '../middleware/auth';
import { validateBody } from '../lib/errors';
import { createZokuSchema, updateZokuSchema, updateZokuTierSchema } from '../lib/validation';
import { NotFoundError, ValidationError } from '../lib/errors';

const app = new Hono<{ Bindings: Bindings }>();

// Get current authenticated user
app.get('/me', async (c) => {
  const user = c.get('user') as Zoku;
  return c.json({ user });
});

// List zoku
app.get('/', async (c) => {
  const db = new DB(c.env.DB);

  const type = c.req.query('type');
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 20;
  const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : 0;

  const zoku = await db.listZoku({ type, limit, offset });
  return c.json({ zoku });
});

// Get zoku details
app.get('/:id', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const zoku = await db.getZoku(id);
  if (!zoku) {
    throw new NotFoundError('Zoku', id);
  }

  // Get their entanglements and roles
  const entanglements = await db.getZokuEntanglements(id);

  return c.json({
    ...zoku,
    entanglements
  });
});

// Create zoku (Entangled and Prime only)
app.post('/', requireTier('entangled'), async (c) => {
  const currentUser = c.get('user') as Zoku;
  const db = new DB(c.env.DB);
  const body = await validateBody(c, createZokuSchema);

  // Entangled users can only create as 'observed'
  // Prime users can set tier on creation (would need to extend schema)
  const access_tier = 'observed';  // Default for Entangled

  const zoku = await db.createZoku({
    name: body.name,
    description: body.description,
    type: body.type,
    email: body.email || null,
    access_tier,
    created_by: currentUser.id,
    metadata: body.metadata
  });

  await db.createAuditLog({
    zoku_id: currentUser.id,
    action: 'create',
    resource_type: 'zoku',
    resource_id: zoku.id,
    details: JSON.stringify({ tier: access_tier }),
    request_id: c.get('request_id') as string | undefined
  });

  return c.json(zoku, 201);
});

// Update zoku
app.patch('/:id', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');
  const body = await validateBody(c, updateZokuSchema);

  const zoku = await db.getZoku(id);
  if (!zoku) {
    throw new NotFoundError('Zoku', id);
  }

  await db.updateZoku(id, {
    name: body.name,
    description: body.description,
    metadata: body.metadata
  });

  return c.json({ success: true });
});

// Delete zoku
app.delete('/:id', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const zoku = await db.getZoku(id);
  if (!zoku) {
    throw new NotFoundError('Zoku', id);
  }

  await db.deleteZoku(id);
  return c.json({ success: true });
});

// Promote/demote user tier (Prime only)
app.patch('/:id/tier', requireTier('prime'), async (c) => {
  const currentUser = c.get('user') as Zoku;
  const targetId = c.req.param('id');
  const body = await c.req.json();
  const db = new DB(c.env.DB);

  const targetUser = await db.getZoku(targetId);
  if (!targetUser) {
    return c.json({ error: 'User not found' }, 404);
  }

  if (!body.access_tier || !['observed', 'coherent', 'entangled', 'prime'].includes(body.access_tier)) {
    return c.json({ error: 'Invalid access_tier' }, 400);
  }

  const oldTier = targetUser.access_tier;
  const newTier = body.access_tier;

  await db.updateZokuTier(targetId, newTier);
  await db.updateZoku(targetId, { updated_by: currentUser.id });

  await db.createAuditLog({
    zoku_id: currentUser.id,
    action: 'tier_change',
    resource_type: 'zoku',
    resource_id: targetId,
    details: JSON.stringify({ from: oldTier, to: newTier }),
    request_id: c.get('request_id') as string | undefined
  });

  return c.json({ success: true, tier: newTier });
});

export default app;
