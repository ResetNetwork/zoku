import { Hono, type Context } from 'hono';
import type { HonoEnv, Bindings, Zoku } from '../types';
import { DB } from '../db';
import { Logger } from '../lib/logger';
import { JewelService } from '../services/jewels';

const app = new Hono<HonoEnv>();

const getService = (c: Context<HonoEnv>) => {
  const db = new DB(c.env.DB);
  const user = c.get('user');
  const logger = c.get('logger');
  const requestId = c.get('request_id');
  return new JewelService(db, user, logger, requestId, c.env);
};

// List jewels
app.get('/', async (c) => {
  const service = getService(c);
  const jewels = await service.list({
    type: c.req.query('type'),
    limit: c.req.query('limit') ? parseInt(c.req.query('limit')!) : 20
  });
  return c.json({ jewels });
});

// Get jewel
app.get('/:id', async (c) => {
  const service = getService(c);
  const jewel = await service.get(c.req.param('id'));
  return c.json(jewel);
});

// Create jewel
app.post('/', async (c) => {
  const service = getService(c);
  const body = await c.req.json();
  const jewel = await service.create(body);
  return c.json(jewel, 201);
});

// Update jewel
app.patch('/:id', async (c) => {
  const service = getService(c);
  const body = await c.req.json();
  await service.update(c.req.param('id'), body);
  return c.json({ success: true });
});

// Delete jewel
app.delete('/:id', async (c) => {
  const service = getService(c);
  await service.delete(c.req.param('id'));
  return c.json({ success: true });
});

// Get jewel usage
app.get('/:id/usage', async (c) => {
  const service = getService(c);
  const usage = await service.getUsage(c.req.param('id'));
  return c.json({ sources: usage });
});

export default app;
