import { Hono } from 'hono';
import type { Bindings, Zoku } from '../types';
import { DB } from '../db';
import { authMiddleware, requireTier } from '../middleware/auth';

const app = new Hono<{ Bindings: Bindings }>();

// Get current authenticated user
app.get('/me', authMiddleware(), async (c) => {
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
    return c.json({ error: { code: 'NOT_FOUND', message: 'Zoku not found' } }, 404);
  }

  // Get their entanglements and roles
  const entanglements = await db.getZokuEntanglements(id);

  return c.json({
    ...zoku,
    entanglements
  });
});

// Create zoku (Entangled and Prime only)
app.post('/', authMiddleware(), requireTier('entangled'), async (c) => {
  const currentUser = c.get('user') as Zoku;
  const db = new DB(c.env.DB);
  const body = await c.req.json();

  if (!body.name || !body.type) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'name and type are required' } }, 400);
  }

  if (!['human', 'agent'].includes(body.type)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'type must be human or agent' } }, 400);
  }

  // Entangled users can only create as 'observed'
  // Prime users can set tier on creation
  let access_tier = 'observed';  // Default for Entangled

  if (currentUser.access_tier === 'prime' && body.access_tier) {
    // Only admins can set tier on creation
    access_tier = body.access_tier;
  }

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
    request_id: c.get('requestId')
  });

  return c.json(zoku, 201);
});

// Update zoku
app.patch('/:id', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');
  const body = await c.req.json();

  const zoku = await db.getZoku(id);
  if (!zoku) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Zoku not found' } }, 404);
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
    return c.json({ error: { code: 'NOT_FOUND', message: 'Zoku not found' } }, 404);
  }

  await db.deleteZoku(id);
  return c.json({ success: true });
});

// Promote/demote user tier (Prime only)
app.patch('/:id/tier', authMiddleware(), requireTier('prime'), async (c) => {
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
    request_id: c.get('requestId')
  });

  return c.json({ success: true, tier: newTier });
});

export default app;
