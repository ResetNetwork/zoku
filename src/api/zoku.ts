import { Hono, type Context } from 'hono';
import type { HonoEnv, Bindings, Zoku } from '../types';
import { DB } from '../db';
import { Logger } from '../lib/logger';
import { ZokuService } from '../services/zoku';

const app = new Hono<HonoEnv>();

const getService = (c: Context<HonoEnv>) => {
  const db = new DB(c.env.DB);
  const user = c.get('user');
  const logger = c.get('logger');
  const requestId = c.get('request_id');
  return new ZokuService(db, user, logger, requestId);
};

// Get current user
app.get('/me', async (c) => {
  const user = c.get('user') as Zoku;
  return c.json({ user });
});

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
