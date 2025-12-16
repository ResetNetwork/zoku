import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { HonoEnv, Bindings } from './types';
import { loggingMiddleware } from './middleware/logging';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './lib/errors';

import entanglementsRoutes from './api/entanglements';
import zokuRoutes from './api/zoku';
import quptsRoutes from './api/qupts';
import sourcesRoutes from './api/sources';
import dimensionsRoutes from './api/dimensions';
import jewelsRoutes from './api/jewels';
import googleOAuthRoutes from './api/google-oauth';
import mcpTokensRoutes from './api/mcp-tokens';
import { mcpOAuthPublicRoutes, mcpOAuthProtectedRoutes } from './api/mcp-oauth';
import auditLogsRoutes from './api/audit-logs';
import oauthAppsRoutes from './api/oauth-apps';

const app = new Hono<HonoEnv>();

// Enable CORS for frontend
app.use('/*', cors());

// Enable logging for all requests
app.use('/*', loggingMiddleware());

// Enable global error handling (catches all errors, sanitizes messages)
app.use('/*', errorHandler());

// ============================================================================
// PUBLIC ROUTES (No authentication required)
// These must be defined BEFORE global auth middleware
// ============================================================================

// Health check (for monitoring systems)
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'zoku' });
});

// MCP OAuth public endpoints (required for OAuth flow - client has no JWT yet)
// Note: In production, configure Cloudflare Access to bypass these paths
app.route('/', mcpOAuthPublicRoutes);  // /.well-known/oauth-authorization-server
app.route('/oauth', mcpOAuthPublicRoutes);  // /oauth/token, /oauth/register, /oauth/revoke

// ============================================================================
// GLOBAL AUTHENTICATION MIDDLEWARE
// All routes below this point require authentication
// ============================================================================

// Protect all API routes with Cloudflare Access JWT
app.use('/api/*', authMiddleware());

// ============================================================================
// PROTECTED ROUTES (Authentication required)
// ============================================================================

// MCP OAuth protected endpoints (require CF Access JWT for user interaction)
app.route('/oauth', mcpOAuthProtectedRoutes);  // /oauth/authorize, /oauth/sessions

// API routes (all protected by authMiddleware above)
app.route('/api/entanglements', entanglementsRoutes);
app.route('/api/zoku', zokuRoutes);
app.route('/api/qupts', quptsRoutes);
app.route('/api/sources', sourcesRoutes);
app.route('/api/dimensions', dimensionsRoutes);
app.route('/api/jewels', jewelsRoutes);
app.route('/api/oauth', googleOAuthRoutes);  // Google OAuth for jewels
app.route('/api/mcp-tokens', mcpTokensRoutes);  // Personal Access Tokens
app.route('/api/audit-logs', auditLogsRoutes);  // Audit log (Prime only)
app.route('/api/oauth-apps', oauthAppsRoutes);  // OAuth Applications (Prime only)

// MCP endpoint (has its own Bearer token authentication inside handler)
import { handleMcpRequest } from './mcp/server';
app.all('/mcp', handleMcpRequest);

// Webhook endpoint (will implement in Phase 3)
// Note: Protected by global authMiddleware above
app.post('/webhook/:source_id', async (c) => {
  return c.json({ error: 'Webhook endpoint not yet implemented' }, 501);
});

import { handleScheduled } from './scheduled';

export default {
  fetch: app.fetch,
  scheduled: handleScheduled
};
