import { Hono } from 'hono';
import type { Bindings } from '../types';
import { DB } from '../db';
import { requireTier } from '../middleware/auth';
import { validateBody } from '../lib/errors';
import { createQuptSchema, batchCreateQuptsSchema } from '../lib/validation';
import { NotFoundError } from '../lib/errors';

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
    throw new NotFoundError('Qupt', id);
  }

  return c.json(qupt);
});

// Create qupt (Entangled and Prime only)
app.post('/', requireTier('entangled'), async (c) => {
  const db = new DB(c.env.DB);
  const body = await validateBody(c, createQuptSchema);

  // Verify entanglement exists
  const entanglement = await db.getEntanglement(body.entanglement_id);
  if (!entanglement) {
    throw new NotFoundError('Entanglement', body.entanglement_id);
  }

  // Verify zoku exists if provided
  if (body.zoku_id) {
    const zoku = await db.getZoku(body.zoku_id);
    if (!zoku) {
      throw new NotFoundError('Zoku', body.zoku_id);
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
  const body = await validateBody(c, batchCreateQuptsSchema);

  await db.batchCreateQupts(body.qupts);
  return c.json({ success: true, count: body.qupts.length }, 201);
});

// Delete qupt (Entangled and Prime only)
app.delete('/:id', requireTier('entangled'), async (c) => {
  const db = new DB(c.env.DB);
  const id = c.req.param('id');

  const qupt = await db.getQupt(id);
  if (!qupt) {
    throw new NotFoundError('Qupt', id);
  }

  await db.deleteQupt(id);
  return c.json({ success: true });
});

export default app;
