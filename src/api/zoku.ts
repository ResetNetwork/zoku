import { Hono } from 'hono';
import type { Bindings } from '../types';
import { DB } from '../db';

const app = new Hono<{ Bindings: Bindings }>();

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

// Create zoku
app.post('/', async (c) => {
  const db = new DB(c.env.DB);
  const body = await c.req.json();

  if (!body.name || !body.type) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'name and type are required' } }, 400);
  }

  if (!['human', 'agent'].includes(body.type)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'type must be human or agent' } }, 400);
  }

  const zoku = await db.createZoku({
    name: body.name,
    description: body.description,
    type: body.type,
    metadata: body.metadata
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

export default app;
