import { Hono } from 'hono';
import type { Bindings } from '../types';
import { DB } from '../db';

const app = new Hono<{ Bindings: Bindings }>();

// List qupts
app.get('/', async (c) => {
  const db = new DB(c.env.DB);

  const volitionId = c.req.query('volition_id');
  const recursive = c.req.query('recursive') === 'true';
  const entangledId = c.req.query('entangled_id');
  const source = c.req.query('source');
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 20;
  const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : 0;

  const qupts = await db.listQupts({
    volition_id: volitionId,
    recursive,
    entangled_id: entangledId,
    source,
    limit,
    offset
  });

  return c.json({ qupts, total: qupts.length, limit, offset });
});

// Get single qupt
app.get('/:id', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const qupt = await db.getQupt(id);
  if (!qupt) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Qupt not found' } }, 404);
  }

  return c.json(qupt);
});

// Create qupt
app.post('/', async (c) => {
  const db = new DB(c.env.DB);
  const body = await c.req.json();

  if (!body.volition_id || !body.content) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'volition_id and content are required' } }, 400);
  }

  // Verify volition exists
  const volition = await db.getVolition(body.volition_id);
  if (!volition) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Volition not found' } }, 404);
  }

  // Verify entangled exists if provided
  if (body.entangled_id) {
    const entangled = await db.getEntangled(body.entangled_id);
    if (!entangled) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Entangled entity not found' } }, 404);
    }
  }

  const qupt = await db.createQupt({
    volition_id: body.volition_id,
    entangled_id: body.entangled_id,
    content: body.content,
    source: body.source || 'manual',
    external_id: body.external_id,
    metadata: body.metadata
  });

  return c.json(qupt, 201);
});

// Batch create qupts
app.post('/batch', async (c) => {
  const db = new DB(c.env.DB);
  const body = await c.req.json();

  if (!body.qupts || !Array.isArray(body.qupts)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'qupts array is required' } }, 400);
  }

  // Validate all qupts
  for (const qupt of body.qupts) {
    if (!qupt.volition_id || !qupt.content) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Each qupt must have volition_id and content' } }, 400);
    }
  }

  await db.batchCreateQupts(body.qupts);
  return c.json({ success: true, count: body.qupts.length }, 201);
});

// Delete qupt
app.delete('/:id', async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const qupt = await db.getQupt(id);
  if (!qupt) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Qupt not found' } }, 404);
  }

  await db.deleteQupt(id);
  return c.json({ success: true });
});

export default app;
