// MCP Personal Access Token (PAT) management
// JWT-based tokens with KV blocklist for revocation
import { SignJWT, jwtVerify } from 'jose';
import type { Bindings, Zoku, PatMetadata } from '../types';
import type { DB } from '../db';

// In-memory cache for token validation (per-worker instance)
// Avoids KV revocation check on every tool call
const tokenCache = new Map<string, { user: Zoku; cachedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a new MCP Personal Access Token (JWT)
 * Returns the signed JWT and metadata
 */
export async function generateMcpToken(
  env: Bindings,
  db: DB,
  zoku_id: string,
  name: string,
  expiresInDays: 30 | 60 | 90 | 365
): Promise<{ token: string; metadata: PatMetadata }> {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }
  // AUTH_KV is optional in dev - tokens still work without KV storage

  const user = await db.getZoku(zoku_id);
  if (!user) throw new Error('User not found');

  const tokenId = `tok-${crypto.randomUUID()}`;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + expiresInDays * 86400;

  // Sign JWT
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const token = await new SignJWT({
    name,
    tier: user.access_tier,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(zoku_id)
    .setJti(tokenId)
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(secret);

  // Store metadata in KV (if available)
  const metadata: PatMetadata = {
    id: tokenId,
    name,
    created_at: now,
    expires_at: expiresAt,
    last_used: null,
  };

  if (env.AUTH_KV) {
    const kvKey = `pat:user:${zoku_id}`;
    const existing = (await env.AUTH_KV.get(kvKey, 'json')) as PatMetadata[] || [];
    existing.push(metadata);
    await env.AUTH_KV.put(kvKey, JSON.stringify(existing));
  } else {
    console.warn('AUTH_KV not configured - token metadata not persisted (dev mode)');
  }

  return { token, metadata };
}

/**
 * Validate MCP token and return user
 * Tries OAuth tokens first (from OAuth provider), then falls back to PAT (JWT)
 * Uses session-aware caching: full check on initialize, cached on subsequent calls
 */
export async function validateMcpToken(
  token: string,
  env: Bindings,
  db: DB,
  isInitialize: boolean = false
): Promise<Zoku> {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }

  // Try OAuth token first (if OAuth is configured)
  if (env.AUTH_KV && env.APP_URL) {
    try {
      const { validateOAuthToken } = await import('./mcp-oauth');
      const tokenData = await validateOAuthToken(env, token);

      if (tokenData?.user_id) {
        const user = await db.getZoku(tokenData.user_id);
        if (!user) throw new Error('OAuth token valid but user not found');
        if (user.access_tier === 'observed') throw new Error('Access revoked');
        return user;
      }
    } catch (oauthError) {
      // Not an OAuth token or validation failed, fall back to PAT
      // Don't log error - PAT validation will be attempted
    }
  }

  // PAT validation (JWT-based) - fallback or primary in dev
  try {
    // Verify JWT signature
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    // Reject OAuth tokens (they should be handled above)
    if (payload.token_type === 'oauth' || payload.token_type === 'oauth_refresh') {
      throw new Error('OAuth token must be validated via OAuth flow');
    }

    const jti = payload.jti as string;
    const userId = payload.sub as string;

    // Check cache (skip revocation check unless initialize or cache expired)
    const cached = tokenCache.get(jti);
    if (!isInitialize && cached && (Date.now() - cached.cachedAt < CACHE_TTL)) {
      return cached.user;
    }

    // Check revocation in KV (only on initialize or cache miss)
    if (env.AUTH_KV) {
      const isRevoked = await env.AUTH_KV.get(`pat:revoked:${jti}`);
      if (isRevoked) {
        tokenCache.delete(jti);  // Clear cache
        throw new Error('Token has been revoked');
      }
    }

    // Load user from D1
    const user = await db.getZoku(userId);
    if (!user) throw new Error('User not found');
    if (user.access_tier === 'observed') throw new Error('Access revoked');

    // Update last_used timestamp (async, don't wait)
    if (isInitialize) {
      updateLastUsed(env, userId, jti).catch(console.error);
    }

    // Cache for subsequent requests in this session
    tokenCache.set(jti, { user, cachedAt: Date.now() });

    return user;
  } catch (error) {
    throw new Error(`Token validation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Update last_used timestamp for a PAT (async, non-blocking)
 */
async function updateLastUsed(
  env: Bindings,
  userId: string,
  tokenId: string
): Promise<void> {
  if (!env.AUTH_KV) return;

  const kvKey = `pat:user:${userId}`;
  const tokens = (await env.AUTH_KV.get(kvKey, 'json')) as PatMetadata[] || [];

  const updated = tokens.map((t) =>
    t.id === tokenId ? { ...t, last_used: Math.floor(Date.now() / 1000) } : t
  );

  await env.AUTH_KV.put(kvKey, JSON.stringify(updated));
}

/**
 * Revoke a PAT by adding it to the blocklist
 */
export async function revokeMcpToken(
  env: Bindings,
  userId: string,
  tokenId: string
): Promise<void> {
  if (!env.AUTH_KV) {
    console.warn('AUTH_KV not configured - cannot revoke token (dev mode)');
    return;
  }

  // Get token metadata to find expiration
  const kvKey = `pat:user:${userId}`;
  const tokens = (await env.AUTH_KV.get(kvKey, 'json')) as PatMetadata[] || [];
  const token = tokens.find((t) => t.id === tokenId);

  if (!token) throw new Error('Token not found');

  // Add to blocklist with TTL = time until expiration
  const ttl = Math.max(0, token.expires_at - Math.floor(Date.now() / 1000));
  await env.AUTH_KV.put(`pat:revoked:${tokenId}`, '1', { expirationTtl: ttl });

  // Remove from user's token list
  const remaining = tokens.filter((t) => t.id !== tokenId);
  await env.AUTH_KV.put(kvKey, JSON.stringify(remaining));

  // Clear cache
  tokenCache.delete(tokenId);
}

/**
 * List user's PATs (for Account page)
 */
export async function listMcpTokens(
  env: Bindings,
  userId: string
): Promise<PatMetadata[]> {
  if (!env.AUTH_KV) {
    // In dev mode without KV, return empty array
    console.warn('AUTH_KV not configured - returning empty token list (dev mode)');
    return [];
  }

  const kvKey = `pat:user:${userId}`;
  return (await env.AUTH_KV.get(kvKey, 'json')) as PatMetadata[] || [];
}
