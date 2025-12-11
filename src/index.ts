import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Bindings } from './types';

import volitionsRoutes from './api/volitions';
import entangledRoutes from './api/entangled';
import quptsRoutes from './api/qupts';
import sourcesRoutes from './api/sources';
import dimensionsRoutes from './api/dimensions';
import credentialsRoutes from './api/credentials';

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for frontend
app.use('/*', cors());

// API routes
app.route('/api/volitions', volitionsRoutes);
app.route('/api/entangled', entangledRoutes);
app.route('/api/qupts', quptsRoutes);
app.route('/api/sources', sourcesRoutes);
app.route('/api/dimensions', dimensionsRoutes);
app.route('/api/credentials', credentialsRoutes);

// MCP endpoint
import { mcpHandler } from './mcp/server';
app.all('/mcp', mcpHandler);

// Webhook endpoint (will implement in Phase 3)
app.post('/webhook/:source_id', async (c) => {
  return c.json({ error: 'Webhook endpoint not yet implemented' }, 501);
});

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'zoku' });
});

import { handleScheduled } from './scheduled';

export default {
  fetch: app.fetch,
  scheduled: handleScheduled
};
