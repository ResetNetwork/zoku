// MCP Personal Access Token (PAT) management API
import { Hono } from 'hono';
import { authMiddleware, requireTier } from '../middleware/auth';
import { generateMcpToken, listMcpTokens, revokeMcpToken } from '../lib/mcp-tokens';
import { DB } from '../db';
import type { Bindings, Zoku } from '../types';

const app = new Hono<{ Bindings: Bindings }>();

// List user's tokens (from KV)
app.get('/', authMiddleware(), async (c) => {
  const user = c.get('user') as Zoku;
  const tokens = await listMcpTokens(c.env, user.id);

  return c.json({ tokens });
});

// Create new token (JWT-based PAT)
app.post('/', authMiddleware(), requireTier('coherent'), async (c) => {
  const user = c.get('user') as Zoku;
  const body = await c.req.json();
  const db = new DB(c.env.DB);

  if (!body.expires_in_days || ![30, 60, 90, 365].includes(body.expires_in_days)) {
    return c.json({ error: 'expires_in_days must be 30, 60, 90, or 365' }, 400);
  }

  const { token, metadata } = await generateMcpToken(
    c.env,
    db,
    user.id,
    body.name || 'Unnamed Token',
    body.expires_in_days
  );

  return c.json({
    token,     // JWT - shown only once
    metadata   // Token info for display
  });
});

// Revoke token (add to KV blocklist)
app.delete('/:id', authMiddleware(), async (c) => {
  const user = c.get('user') as Zoku;
  const tokenId = c.req.param('id');

  // Get token to check ownership
  const tokens = await listMcpTokens(c.env, user.id);
  const token = tokens.find((t) => t.id === tokenId);

  if (!token && user.access_tier !== 'prime') {
    return c.json({ error: 'Can only revoke your own tokens' }, 403);
  }

  await revokeMcpToken(c.env, user.id, tokenId);

  return c.json({ success: true });
});

export default app;
