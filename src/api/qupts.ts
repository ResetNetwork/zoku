import { Hono } from 'hono';
import type { HonoEnv, Bindings, Zoku } from '../types';
import { DB } from '../db';
import { Logger } from '../lib/logger';
import { QuptService } from '../services/qupts';

const app = new Hono<HonoEnv>();

const getService = (c: any) => {
  const db = new DB(c.env.DB);
  const user = c.get('user') as Zoku;
  const logger = c.get('logger') as Logger;
  const requestId = c.get('request_id') as string;
  return new QuptService(db, user, logger, requestId);
};

// List qupts
app.get('/', async (c) => {
  const service = getService(c);
  
  // Parse entanglement_ids query param (comma-separated)
  const entanglementIdsParam = c.req.query('entanglement_ids');
  const entanglementIds = entanglementIdsParam ? entanglementIdsParam.split(',') : undefined;
  
  const qupts = await service.list({
    entanglement_id: c.req.query('entanglement_id'),
    entanglement_ids: entanglementIds,
    recursive: c.req.query('recursive') !== 'false',
    zoku_id: c.req.query('zoku_id'),
    source: c.req.query('source'),
    since: c.req.query('since') ? parseInt(c.req.query('since')!) : undefined,
    until: c.req.query('until') ? parseInt(c.req.query('until')!) : undefined,
    limit: c.req.query('limit') ? parseInt(c.req.query('limit')!) : 20,
    offset: c.req.query('offset') ? parseInt(c.req.query('offset')!) : 0
  });
  return c.json({ qupts });
});

// Get qupt
app.get('/:id', async (c) => {
  const service = getService(c);
  const qupt = await service.get(c.req.param('id'));
  return c.json(qupt);
});

// Create qupt
app.post('/', async (c) => {
  const service = getService(c);
  const body = await c.req.json();
  const qupt = await service.create(body);
  return c.json(qupt, 201);
});

// Batch create qupts
app.post('/batch', async (c) => {
  const service = getService(c);
  const body = await c.req.json();
  const result = await service.batchCreate(body);
  return c.json(result, 201);
});

// Delete qupt
app.delete('/:id', async (c) => {
  const service = getService(c);
  await service.delete(c.req.param('id'));
  return c.json({ success: true });
});

export default app;
