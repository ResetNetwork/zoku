// MCP Personal Access Token (PAT) management API
import { Hono } from 'hono';
import { requireTier } from '../middleware/auth';
import { generateMcpToken, listMcpTokens, revokeMcpToken } from '../lib/mcp-tokens';
import { DB } from '../db';
import type { Bindings, Zoku } from '../types';

const app = new Hono<{ Bindings: Bindings }>();

// List user's tokens (from KV)
app.get('/', async (c) => {
  const user = c.get('user') as Zoku;
  const tokens = await listMcpTokens(c.env, user.id);

  return c.json({ tokens });
});

// Create new token (JWT-based PAT)
app.post('/', requireTier('coherent'), async (c) => {
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

  // Audit log
  await db.createAuditLog({
    zoku_id: user.id,
    action: 'create',
    resource_type: 'pat_token',
    resource_id: metadata.id,
    details: JSON.stringify({ name: metadata.name, expires_in_days: body.expires_in_days }),
    ip_address: c.req.header('cf-connecting-ip') || null,
    user_agent: c.req.header('user-agent') || null,
    request_id: c.get('request_id') || null
  });

  return c.json({
    token,     // JWT - shown only once
    metadata   // Token info for display
  });
});

// Revoke token (add to KV blocklist)
app.delete('/:id', async (c) => {
  const user = c.get('user') as Zoku;
  const tokenId = c.req.param('id');

  // Get token to check ownership
  const tokens = await listMcpTokens(c.env, user.id);
  const token = tokens.find((t) => t.id === tokenId);

  if (!token && user.access_tier !== 'prime') {
    return c.json({ error: 'Can only revoke your own tokens' }, 403);
  }

  await revokeMcpToken(c.env, user.id, tokenId);

  // Audit log
  const db = new DB(c.env.DB);
  await db.createAuditLog({
    zoku_id: user.id,
    action: 'revoke',
    resource_type: 'pat_token',
    resource_id: tokenId,
    details: JSON.stringify({ name: token?.name || 'Unknown' }),
    ip_address: c.req.header('cf-connecting-ip') || null,
    user_agent: c.req.header('user-agent') || null,
    request_id: c.get('request_id') || null
  });

  return c.json({ success: true });
});

export default app;
