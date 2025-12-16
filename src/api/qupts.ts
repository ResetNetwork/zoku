import { Hono } from 'hono';
import type { Bindings } from '../types';
import { DB } from '../db';
import { requireTier } from '../middleware/auth';

const app = new Hono<{ Bindings: Bindings }>();

// List qupts
app.get('/', async (c) => {
  const db = new DB(c.env.DB);

  const entanglementId = c.req.query('entanglement_id');
  const recursive = c.req.query('recursive') === 'true';
  const zokuId = c.req.query('zoku_id');
  const source = c.req.query('source');
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 20;
  const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : 0;

  const qupts = await db.listQupts({
    entanglement_id: entanglementId,
    recursive,
    zoku_id: zokuId,
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

// Create qupt (Entangled and Prime only)
app.post('/', requireTier('entangled'), async (c) => {
  const db = new DB(c.env.DB);
  const body = await c.req.json();

  if (!body.entanglement_id || !body.content) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'entanglement_id and content are required' } }, 400);
  }

  // Verify entanglement exists
  const entanglement = await db.getEntanglement(body.entanglement_id);
  if (!entanglement) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Entanglement not found' } }, 404);
  }

  // Verify zoku exists if provided
  if (body.zoku_id) {
    const zoku = await db.getZoku(body.zoku_id);
    if (!zoku) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Zoku not found' } }, 404);
    }
  }

  const qupt = await db.createQupt({
    entanglement_id: body.entanglement_id,
    zoku_id: body.zoku_id,
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
    if (!qupt.entanglement_id || !qupt.content) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Each qupt must have entanglement_id and content' } }, 400);
    }
  }

  await db.batchCreateQupts(body.qupts);
  return c.json({ success: true, count: body.qupts.length }, 201);
});

// Delete qupt (Entangled and Prime only)
app.delete('/:id', requireTier('entangled'), async (c) => {
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
