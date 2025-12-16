// MCP OAuth 2.1 Endpoints
// User authentication via OAuth for MCP clients (Claude Desktop, etc.)
// Note: This is separate from src/api/google-oauth.ts (which handles Google Drive/Docs jewels)

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import {
  createAuthorizationCode,
  exchangeCodeForToken,
  refreshAccessToken,
  registerClient,
  validateOAuthToken,
  revokeOAuthToken,
  listOAuthSessions,
  revokeOAuthSession
} from '../lib/mcp-oauth';
import type { Bindings, Zoku } from '../types';

// Public routes (no authentication required - for OAuth flow)
export const mcpOAuthPublicRoutes = new Hono<{ Bindings: Bindings }>();

// Protected routes (CF Access JWT required - for user interaction)
export const mcpOAuthProtectedRoutes = new Hono<{ Bindings: Bindings }>();

// ============================================================================
// PUBLIC ROUTES (No authentication required)
// ============================================================================

// RFC 8414 - OAuth 2.0 Authorization Server Metadata Discovery
// MCP clients query this to discover OAuth endpoints
mcpOAuthPublicRoutes.get('/.well-known/oauth-authorization-server', async (c) => {
  // Use request origin dynamically (supports proxy via X-Forwarded-Host)
  const forwardedHost = c.req.header('x-forwarded-host');
  const forwardedProto = c.req.header('x-forwarded-proto') || 'http';
  const requestOrigin = new URL(c.req.url).origin;
  
  // If behind a proxy (e.g., Vite dev server), use forwarded host
  const baseUrl = forwardedHost 
    ? `${forwardedProto}://${forwardedHost}`
    : (c.env.APP_URL || requestOrigin);

  return c.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: `${baseUrl}/oauth/register`,
    revocation_endpoint: `${baseUrl}/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['mcp']
  });
});

// ============================================================================
// PROTECTED ROUTES (CF Access JWT required - for user interaction in browser)
// ============================================================================

// Authorization UI - requires user to be authenticated via Cloudflare Access
mcpOAuthProtectedRoutes.get('/authorize', authMiddleware(), async (c) => {
  const user = c.get('user') as Zoku;
  const query = c.req.query();

  // Check user has access (not observed tier)
  if (user.access_tier === 'observed') {
    return c.html(renderAccessDenied(user), 403);
  }

  // Parse OAuth parameters
  const { client_id, redirect_uri, state, code_challenge, code_challenge_method, scope } = query;

  // Validate required parameters
  if (!client_id || !redirect_uri || !code_challenge) {
    return c.html(renderError('Missing required OAuth parameters: client_id, redirect_uri, or code_challenge'), 400);
  }

  // Validate PKCE (MCP requires S256)
  if (code_challenge_method !== 'S256') {
    return c.html(renderError('PKCE code_challenge_method must be S256'), 400);
  }

  // Validate redirect_uri (must be HTTPS or localhost)
  const redirectUrl = new URL(redirect_uri);
  if (redirectUrl.protocol !== 'https:' && redirectUrl.hostname !== 'localhost' && redirectUrl.hostname !== '127.0.0.1') {
    return c.html(renderError('Redirect URI must use HTTPS or localhost'), 400);
  }

  // Render authorization page
  return c.html(renderAuthorizationPage(user, {
    client_id,
    redirect_uri,
    state: state || '',
    code_challenge,
    code_challenge_method,
    scope: scope || 'mcp'
  }));
});

// Handle user approval/denial
mcpOAuthProtectedRoutes.post('/authorize', authMiddleware(), async (c) => {
  const user = c.get('user') as Zoku;
  const body = await c.req.parseBody();

  const redirect_uri = body.redirect_uri as string;
  const state = (body.state as string) || '';

  // Check tier
  if (user.access_tier === 'observed') {
    const redirect = new URL(redirect_uri);
    redirect.searchParams.set('error', 'access_denied');
    redirect.searchParams.set('error_description', 'User has no access tier');
    if (state) redirect.searchParams.set('state', state);
    return c.redirect(redirect.toString());
  }

  // User denied
  if (body.action !== 'approve') {
    const redirect = new URL(redirect_uri);
    redirect.searchParams.set('error', 'access_denied');
    redirect.searchParams.set('error_description', 'User denied authorization');
    if (state) redirect.searchParams.set('state', state);
    return c.redirect(redirect.toString());
  }

  // Generate authorization code
  try {
    const code = await createAuthorizationCode(c.env, {
      client_id: body.client_id as string,
      redirect_uri,
      user_id: user.id,
      tier: user.access_tier,
      code_challenge: body.code_challenge as string,
      scope: (body.scope as string) || 'mcp'
    });

    // Audit log - OAuth authorization
    const { DB } = await import('../db');
    const db = new DB(c.env.DB);
    await db.createAuditLog({
      zoku_id: user.id,
      action: 'authorize',
      resource_type: 'oauth_session',
      resource_id: body.client_id as string,
      details: JSON.stringify({ client_id: body.client_id, scope: body.scope || 'mcp' }),
      ip_address: c.req.header('cf-connecting-ip') || null,
      user_agent: c.req.header('user-agent') || null,
      request_id: c.get('request_id') || null
    });

    // Build redirect URL with code
    const redirect = new URL(redirect_uri);
    redirect.searchParams.set('code', code);
    if (state) redirect.searchParams.set('state', state);

    // Show success page with auto-redirect
    return c.html(renderSuccessPage(redirect.toString()));
  } catch (error) {
    console.error('Failed to generate authorization code:', error);
    const redirect = new URL(redirect_uri);
    redirect.searchParams.set('error', 'server_error');
    redirect.searchParams.set('error_description', error instanceof Error ? error.message : 'Failed to generate code');
    if (state) redirect.searchParams.set('state', state);
    return c.redirect(redirect.toString());
  }
});

// Token endpoint - exchange authorization code for access token, or refresh token
mcpOAuthPublicRoutes.post('/token', async (c) => {
  try {
    const body = await c.req.parseBody();
    const grant_type = body.grant_type as string;

    if (grant_type === 'authorization_code') {
      // Exchange code for tokens
      const code = body.code as string;
      const code_verifier = body.code_verifier as string;
      const client_id = body.client_id as string;
      const redirect_uri = body.redirect_uri as string;

      if (!code || !code_verifier || !client_id || !redirect_uri) {
        return c.json({
          error: 'invalid_request',
          error_description: 'Missing required parameters'
        }, 400);
      }

      const tokens = await exchangeCodeForToken(c.env, code, code_verifier, client_id, redirect_uri);
      return c.json(tokens);

    } else if (grant_type === 'refresh_token') {
      // Refresh access token
      const refresh_token = body.refresh_token as string;

      if (!refresh_token) {
        return c.json({
          error: 'invalid_request',
          error_description: 'Missing refresh_token'
        }, 400);
      }

      const tokens = await refreshAccessToken(c.env, refresh_token);
      return c.json(tokens);

    } else {
      return c.json({
        error: 'unsupported_grant_type',
        error_description: `Grant type '${grant_type}' not supported`
      }, 400);
    }
  } catch (error) {
    console.error('Token endpoint error:', error);
    return c.json({
      error: 'invalid_grant',
      error_description: error instanceof Error ? error.message : 'Token exchange failed'
    }, 400);
  }
});

// Dynamic client registration (RFC 7591)
// Allows MCP clients to auto-register without manual configuration
mcpOAuthPublicRoutes.post('/register', async (c) => {
  try {
    const body = await c.req.json();

    if (!body.client_name || !body.redirect_uris || !Array.isArray(body.redirect_uris)) {
      return c.json({
        error: 'invalid_request',
        error_description: 'Missing client_name or redirect_uris'
      }, 400);
    }

    const client = await registerClient(c.env, {
      client_name: body.client_name,
      redirect_uris: body.redirect_uris,
      grant_types: body.grant_types
    });

    return c.json(client);
  } catch (error) {
    console.error('Client registration failed:', error);
    return c.json({
      error: 'server_error',
      error_description: error instanceof Error ? error.message : 'Registration failed'
    }, 500);
  }
});

// Token revocation
mcpOAuthPublicRoutes.post('/revoke', async (c) => {
  try {
    const body = await c.req.parseBody();
    const token = body.token as string;

    if (!token) {
      return c.json({
        error: 'invalid_request',
        error_description: 'Missing token'
      }, 400);
    }

    await revokeOAuthToken(c.env, token);
    return c.json({ success: true });
  } catch (error) {
    console.error('Token revocation failed:', error);
    return c.json({
      error: 'server_error',
      error_description: error instanceof Error ? error.message : 'Revocation failed'
    }, 500);
  }
});

// List user's OAuth sessions (for Account page)
mcpOAuthProtectedRoutes.get('/sessions', authMiddleware(), async (c) => {
  const user = c.get('user') as Zoku;
  const sessions = await listOAuthSessions(c.env, user.id);
  return c.json({ sessions });
});

// Revoke OAuth session by ID (for Account page)
mcpOAuthProtectedRoutes.delete('/sessions/:id', authMiddleware(), async (c) => {
  const user = c.get('user') as Zoku;
  const sessionId = c.req.param('id');

  try {
    await revokeOAuthSession(c.env, user.id, sessionId);

    // Audit log
    const { DB } = await import('../db');
    const db = new DB(c.env.DB);
    await db.createAuditLog({
      zoku_id: user.id,
      action: 'revoke',
      resource_type: 'oauth_session',
      resource_id: sessionId,
      details: JSON.stringify({ action: 'manual_revocation' }),
      ip_address: c.req.header('cf-connecting-ip') || null,
      user_agent: c.req.header('user-agent') || null,
      request_id: c.get('request_id') || null
    });

    return c.json({ success: true });
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to revoke session'
    }, 400);
  }
});

// HTML rendering functions

function renderAuthorizationPage(
  user: Zoku,
  params: {
    client_id: string;
    redirect_uri: string;
    state: string;
    code_challenge: string;
    code_challenge_method: string;
    scope: string;
  }
): string {
  const tierColors = {
    observed: '#6b7280',
    coherent: '#3b82f6',
    entangled: '#8b5cf6',
    prime: '#eab308'
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize MCP Client - The Great Game</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #0a0e1a 0%, #1e1b4b 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #e5e7eb;
    }
    .card {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
      color: #fff;
    }
    .subtitle {
      font-size: 14px;
      color: #9ca3af;
      margin-bottom: 32px;
    }
    .client-info {
      background: rgba(99, 102, 241, 0.1);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .client-name {
      font-size: 18px;
      font-weight: 600;
      color: #818cf8;
      margin-bottom: 4px;
    }
    .user-info {
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .user-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .user-row:last-child { margin-bottom: 0; }
    .label {
      font-size: 14px;
      color: #9ca3af;
    }
    .value {
      font-size: 14px;
      font-weight: 500;
      color: #fff;
    }
    .tier-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      background: ${tierColors[user.access_tier]};
      color: #fff;
    }
    .permissions {
      margin-bottom: 32px;
    }
    .permissions h3 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #fff;
    }
    .permissions ul {
      list-style: none;
      padding-left: 0;
    }
    .permissions li {
      padding: 8px 0;
      padding-left: 24px;
      position: relative;
      color: #d1d5db;
      font-size: 14px;
    }
    .permissions li:before {
      content: "✓";
      position: absolute;
      left: 0;
      color: #22c55e;
      font-weight: bold;
    }
    .actions {
      display: flex;
      gap: 12px;
    }
    button {
      flex: 1;
      padding: 14px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .approve {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: #fff;
    }
    .approve:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
    }
    .deny {
      background: rgba(255, 255, 255, 0.05);
      color: #9ca3af;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .deny:hover {
      background: rgba(255, 255, 255, 0.08);
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authorize MCP Client</h1>
    <p class="subtitle">The Great Game - Project & Initiative Tracking</p>

    <div class="client-info">
      <div class="client-name">${escapeHtml(params.client_id)}</div>
      <div class="label">wants to access your account</div>
    </div>

    <div class="user-info">
      <div class="user-row">
        <span class="label">Signed in as</span>
        <span class="value">${escapeHtml(user.email || user.name)}</span>
      </div>
      <div class="user-row">
        <span class="label">Access Tier</span>
        <span class="tier-badge">${user.access_tier}</span>
      </div>
    </div>

    <div class="permissions">
      <h3>This will allow the client to:</h3>
      <ul>
        <li>View and manage entanglements (projects)</li>
        <li>View and manage zoku (partners)</li>
        <li>Access activity streams (qupts)</li>
        <li>Manage sources and jewels</li>
        <li>Perform actions based on your tier (${user.access_tier})</li>
      </ul>
    </div>

    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="client_id" value="${escapeHtml(params.client_id)}">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirect_uri)}">
      <input type="hidden" name="state" value="${escapeHtml(params.state)}">
      <input type="hidden" name="code_challenge" value="${escapeHtml(params.code_challenge)}">
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(params.code_challenge_method)}">
      <input type="hidden" name="scope" value="${escapeHtml(params.scope)}">

      <div class="actions">
        <button type="submit" name="action" value="approve" class="approve">
          Authorize
        </button>
        <button type="submit" name="action" value="deny" class="deny">
          Deny
        </button>
      </div>
    </form>
  </div>
</body>
</html>`;
}

function renderAccessDenied(user: Zoku): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access Denied</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0e1a;
      color: #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      text-align: center;
    }
    h1 {
      font-size: 28px;
      color: #ef4444;
      margin-bottom: 16px;
    }
    p {
      font-size: 16px;
      line-height: 1.6;
      color: #9ca3af;
      margin-bottom: 12px;
    }
    .email {
      color: #818cf8;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Access Denied</h1>
    <p>
      Your account (${escapeHtml(user.email || user.name)}) exists in the system but has not been granted access.
    </p>
    <p>
      Contact a system administrator to request access:
      <br><span class="email">admin@reset.tech</span>
    </p>
  </div>
</body>
</html>`;
}

function renderError(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OAuth Error</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0e1a;
      color: #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      text-align: center;
    }
    h1 {
      font-size: 28px;
      color: #f59e0b;
      margin-bottom: 16px;
    }
    p {
      font-size: 16px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Invalid Request</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
}

function renderSuccessPage(redirectUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorization Successful</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #0a0e1a 0%, #1e1b4b 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #e5e7eb;
    }
    .card {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      text-align: center;
    }
    .success-icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 24px;
      color: #22c55e;
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 12px;
      color: #22c55e;
    }
    p {
      font-size: 16px;
      color: #9ca3af;
      margin-bottom: 8px;
    }
    .countdown {
      font-size: 14px;
      color: #6b7280;
      margin-top: 24px;
    }
  </style>
</head>
<body>
  <div class="card">
    <svg class="success-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>
    <h1>Authorization Successful!</h1>
    <p>You can close this window.</p>
    <p>Return to Claude Code.</p>
    <p class="countdown">Closing automatically in <span id="timer">5</span> seconds...</p>
  </div>

  <script>
    let seconds = 5;
    const timerEl = document.getElementById('timer');

    const countdown = setInterval(() => {
      seconds--;
      if (timerEl) timerEl.textContent = seconds.toString();

      if (seconds <= 0) {
        clearInterval(countdown);
        window.location.href = '${escapeHtml(redirectUrl)}';
      }
    }, 1000);

    // Also redirect immediately if user clicks anywhere
    document.addEventListener('click', () => {
      clearInterval(countdown);
      window.location.href = '${escapeHtml(redirectUrl)}';
    });
  </script>
</body>
</html>`;
}

// HTML escape helper
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


