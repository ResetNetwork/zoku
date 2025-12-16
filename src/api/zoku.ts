import { Hono } from 'hono';
import type { Bindings, Zoku } from '../types';
import { DB } from '../db';
import { Logger } from '../lib/logger';
import { ZokuService } from '../services/zoku';

const app = new Hono<{ Bindings: Bindings }>();

const getService = (c: any) => {
  const db = new DB(c.env.DB);
  const user = c.get('user') as Zoku;
  const logger = c.get('logger') as Logger;
  const requestId = c.get('request_id') as string;
  return new ZokuService(db, user, logger, requestId);
};

// List zoku
app.get('/', async (c) => {
  const service = getService(c);
  const zoku = await service.list({
    type: c.req.query('type'),
    limit: c.req.query('limit') ? parseInt(c.req.query('limit')!) : 20
  });
  return c.json({ zoku });
});

// Get zoku
app.get('/:id', async (c) => {
  const service = getService(c);
  const zoku = await service.get(c.req.param('id'));
  return c.json(zoku);
});

// Create zoku
app.post('/', async (c) => {
  const service = getService(c);
  const body = await c.req.json();
  const zoku = await service.create(body);
  return c.json(zoku, 201);
});

// Update zoku
app.patch('/:id', async (c) => {
  const service = getService(c);
  const body = await c.req.json();
  await service.update(c.req.param('id'), body);
  return c.json({ success: true });
});

// Delete zoku
app.delete('/:id', async (c) => {
  const service = getService(c);
  await service.delete(c.req.param('id'));
  return c.json({ success: true });
});

// Update tier (Prime only)
app.patch('/:id/tier', async (c) => {
  const service = getService(c);
  const body = await c.req.json();
  const result = await service.updateTier(c.req.param('id'), body);
  return c.json(result);
});

export default app;
