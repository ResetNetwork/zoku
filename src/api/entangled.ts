import { Hono } from 'hono';
import type { Bindings } from '../types';
import { DB } from '../db';

const app = new Hono<{ Bindings: Bindings }>();

// List entangled
app.get('/', async (c) => {
  const db = new DB(c.env.DB);

  const type = c.req.query('type');
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 20;
  const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : 0;

  const entangled = await db.listEntangled({ type, limit, offset });
  return c.json({ entangled });
});

// Get entangled details
app.get('/:id', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const entangled = await db.getEntangled(id);
  if (!entangled) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Entangled entity not found' } }, 404);
  }

  return c.json(entangled);
});

// Create entangled
app.post('/', async (c) => {
  const db = new DB(c.env.DB);
  const body = await c.req.json();

  if (!body.name || !body.type) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'name and type are required' } }, 400);
  }

  if (!['human', 'agent'].includes(body.type)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'type must be human or agent' } }, 400);
  }

  const entangled = await db.createEntangled({
    name: body.name,
    type: body.type,
    metadata: body.metadata
  });

  return c.json(entangled, 201);
});

// Update entangled
app.patch('/:id', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');
  const body = await c.req.json();

  const entangled = await db.getEntangled(id);
  if (!entangled) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Entangled entity not found' } }, 404);
  }

  await db.updateEntangled(id, {
    name: body.name,
    metadata: body.metadata
  });

  return c.json({ success: true });
});

// Delete entangled
app.delete('/:id', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const entangled = await db.getEntangled(id);
  if (!entangled) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Entangled entity not found' } }, 404);
  }

  await db.deleteEntangled(id);
  return c.json({ success: true });
});

export default app;
