// Authentication and authorization middleware
import { Context, Next } from 'hono';
import { Logger } from '../lib/logger';
import { validateCloudflareAccessToken, extractCloudflareAccessToken } from '../lib/cf-access';
import { validateMcpToken } from '../lib/mcp-tokens';
import { DB } from '../db';
import type { Bindings, Zoku, AccessTier } from '../types';

/**
 * Authentication middleware for web requests
 * Validates Cloudflare Access JWT and loads user
 */
export function authMiddleware() {
  return async (c: Context, next: Next) => {
    const env = c.env as Bindings;
    const logger = new Logger({
      request_id: c.get('requestId'),
      operation: 'auth_middleware'
    });

    // Development bypass
    if (env.DEV_AUTH_BYPASS === 'true' && env.DEV_USER_EMAIL) {
      const db = new DB(env.DB);
      let user = await db.getZokuByEmail(env.DEV_USER_EMAIL);

      if (!user) {
        // Create dev user with Prime access
        user = await db.createZoku({
          name: 'Dev User',
          type: 'human',
          email: env.DEV_USER_EMAIL,
          access_tier: 'prime',
        });
      }

      c.set('user', user);
      logger.info('Dev auth bypass enabled', { user_id: user.id, email: user.email });
      return next();
    }

    // Extract JWT
    const token = extractCloudflareAccessToken(c.req.raw);
    if (!token) {
      logger.warn('Missing CF Access JWT');
      return c.json({ error: 'Authentication required' }, 401);
    }

    try {
      // Validate JWT
      const payload = await validateCloudflareAccessToken(token, env);
      logger.info('CF Access token validated', { email: payload.email });

      // Load or create user
      const db = new DB(env.DB);
      let user = await db.getZokuByEmail(payload.email);

      if (!user) {
        // First-time user: auto-create as Coherent (read-only)
        user = await db.createZoku({
          name: payload.email.split('@')[0],  // Use email prefix as name
          type: 'human',
          email: payload.email,
          access_tier: 'coherent',
          cf_access_sub: payload.sub,
        });
        logger.info('New user auto-created', { user_id: user.id, tier: 'coherent' });
      } else if (user.access_tier === 'observed') {
        // Existing user was pre-created for PASCI matrix but never authenticated
        // Auto-promote to Coherent on first login
        await db.updateZokuTier(user.id, 'coherent');
        user.access_tier = 'coherent';
        logger.info('User auto-promoted from observed to coherent', { user_id: user.id });
      }

      // Update last login
      await db.updateZoku(user.id, {
        last_login: Math.floor(Date.now() / 1000),
        cf_access_sub: payload.sub  // Update sub if changed
      });

      // Attach user to context
      c.set('user', user);
      logger.info('User authenticated', {
        user_id: user.id,
        tier: user.access_tier
      });

      return next();
    } catch (error) {
      logger.error('Authentication failed', error as Error);
      return c.json({ error: 'Invalid authentication token' }, 401);
    }
  };
}

/**
 * Authorization middleware - checks if user has required tier
 */
export function requireTier(minTier: AccessTier) {
  const tierLevels: Record<AccessTier, number> = {
    observed: 0,
    coherent: 1,
    entangled: 2,
    prime: 3,
  };

  return async (c: Context, next: Next) => {
    const user = c.get('user') as Zoku;
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const env = c.env as Bindings;
    const logger = new Logger({
      request_id: c.get('requestId'),
      user_id: user.id,
      operation: 'require_tier'
    });

    if (tierLevels[user.access_tier] < tierLevels[minTier]) {
      logger.warn('Insufficient permissions', {
        has: user.access_tier,
        needs: minTier
      });
      return c.json({
        error: 'Insufficient permissions',
        message: `This action requires ${minTier} access or higher. You have ${user.access_tier} access.`
      }, 403);
    }

    return next();
  };
}

/**
 * MCP token authentication middleware
 * Validates Bearer token from Authorization header
 * Uses session-aware caching: full check on initialize, cached for tool calls
 */
export async function mcpAuthMiddleware(c: Context, next: Next) {
  const env = c.env as Bindings;
  const logger = new Logger({
    request_id: c.get('requestId'),
    operation: 'mcp_auth'
  });

  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    logger.warn('Missing MCP auth token');
    return c.json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Authentication required' },
      id: null
    }, 401);
  }

  const token = authHeader.substring(7);  // Remove "Bearer "

  try {
    // Parse request to detect initialize method
    const body = await c.req.json();
    const isInitialize = body.method === 'initialize';

    // Validate token with session awareness
    const db = new DB(env.DB);
    const user = await validateMcpToken(token, env, db, isInitialize);

    c.set('user', user);
    c.set('mcpRequest', body);  // Store for handler
    logger.info('MCP token validated', {
      user_id: user.id,
      method: body.method,
      cached: !isInitialize
    });

    return next();
  } catch (error) {
    logger.error('MCP auth failed', error as Error);
    return c.json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Invalid token' },
      id: null
    }, 401);
  }
}
