import { Hono, type Context } from 'hono';
import type { HonoEnv, Zoku } from '../types';
import { OAuthApplicationService } from '../services/oauth-apps';
import { DB } from '../db';
import { Logger } from '../lib/logger';

const app = new Hono<HonoEnv>();

const getService = (c: Context<HonoEnv>) => {
  const db = new DB(c.env.DB);
  const user = c.get('user');
  const logger = c.get('logger');
  const requestId = c.get('request_id');
  return new OAuthApplicationService(db, user, logger, requestId, c.env);
};

/**
 * List all OAuth applications (prime tier only)
 * GET /api/oauth-apps
 */
app.get('/', async (c) => {
  const service = getService(c);
  const provider = c.req.query('provider');
  const apps = await service.list({ provider });
  return c.json({ oauth_applications: apps });
});

/**
 * Get single OAuth application (prime tier only)
 * GET /api/oauth-apps/:id
 */
app.get('/:id', async (c) => {
  const service = getService(c);
  const id = c.req.param('id');
  const app = await service.get(id);

  if (!app) {
    return c.json({ error: { message: 'OAuth application not found', code: 'not_found' } }, 404);
  }

  return c.json(app);
});

/**
 * Create new OAuth application (prime tier only)
 * POST /api/oauth-apps
 */
app.post('/', async (c) => {
  const service = getService(c);
  const body = await c.req.json();

  if (!body.name || !body.provider || !body.client_id || !body.client_secret || !body.scopes) {
    return c.json(
      { error: { message: 'Missing required fields: name, provider, client_id, client_secret, scopes', code: 'validation_error' } },
      400
    );
  }

  const app = await service.create({
    name: body.name,
    provider: body.provider,
    client_id: body.client_id,
    client_secret: body.client_secret,
    scopes: body.scopes,
    metadata: body.metadata
  });

  return c.json(app, 201);
});

/**
 * Update OAuth application (prime tier only)
 * PATCH /api/oauth-apps/:id
 */
app.patch('/:id', async (c) => {
  const service = getService(c);
  const id = c.req.param('id');
  const body = await c.req.json();

  const app = await service.update(id, {
    name: body.name,
    client_id: body.client_id,
    client_secret: body.client_secret,
    scopes: body.scopes,
    metadata: body.metadata
  });

  return c.json(app);
});

/**
 * Delete OAuth application (prime tier only)
 * DELETE /api/oauth-apps/:id
 */
app.delete('/:id', async (c) => {
  const service = getService(c);
  const id = c.req.param('id');
  await service.delete(id);
  return c.json({ success: true });
});

/**
 * List jewels using this OAuth application (prime tier only)
 * GET /api/oauth-apps/:id/jewels
 */
app.get('/:id/jewels', async (c) => {
  const service = getService(c);
  const id = c.req.param('id');
  const jewels = await service.listJewelsUsingApp(id);
  return c.json({ jewels });
});

export default app;
