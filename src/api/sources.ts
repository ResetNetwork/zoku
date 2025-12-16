import { Hono } from 'hono';
import type { HonoEnv, Bindings, Zoku } from '../types';
import { DB } from '../db';
import { Logger } from '../lib/logger';
import { SourceService } from '../services/sources';

const app = new Hono<HonoEnv>();

const getService = (c: any) => {
  const db = new DB(c.env.DB);
  const user = c.get('user') as Zoku;
  const logger = c.get('logger') as Logger;
  const requestId = c.get('request_id') as string;
  return new SourceService(db, user, logger, requestId, c.env);
};

// Get source
app.get('/:id', async (c) => {
  const service = getService(c);
  const source = await service.get(c.req.param('id'));
  return c.json(source);
});

// Update source
app.patch('/:id', async (c) => {
  const service = getService(c);
  const body = await c.req.json();
  await service.update(c.req.param('id'), body);
  return c.json({ success: true });
});

// Delete source (with optional cascade delete of qupts)
app.delete('/:id', async (c) => {
  const service = getService(c);
  const cascadeQupts = c.req.query('cascade') === 'true';
  await service.delete(c.req.param('id'), cascadeQupts);
  return c.json({ success: true });
});

// Manual sync
app.post('/:id/sync', async (c) => {
  const service = getService(c);
  const result = await service.sync(c.req.param('id'));
  return c.json(result);
});

export default app;
