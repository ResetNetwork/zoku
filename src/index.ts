import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Bindings } from './types';
import { loggingMiddleware } from './middleware/logging';

import entanglementsRoutes from './api/entanglements';
import zokuRoutes from './api/zoku';
import quptsRoutes from './api/qupts';
import sourcesRoutes from './api/sources';
import dimensionsRoutes from './api/dimensions';
import jewelsRoutes from './api/jewels';
import googleOAuthRoutes from './api/google-oauth';
import mcpTokensRoutes from './api/mcp-tokens';

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for frontend
app.use('/*', cors());

// Enable logging for all requests
app.use('/*', loggingMiddleware());

// API routes
app.route('/api/entanglements', entanglementsRoutes);
app.route('/api/zoku', zokuRoutes);
app.route('/api/qupts', quptsRoutes);
app.route('/api/sources', sourcesRoutes);
app.route('/api/dimensions', dimensionsRoutes);
app.route('/api/jewels', jewelsRoutes);
app.route('/api/oauth', googleOAuthRoutes);  // Google OAuth for jewels
app.route('/api/mcp-tokens', mcpTokensRoutes);  // Personal Access Tokens

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
