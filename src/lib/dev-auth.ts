// Development Authentication
// Generates fake Cloudflare Access JWTs for local testing
import { SignJWT } from 'jose';
import type { Bindings } from '../types';

/**
 * Generate a development JWT that mimics Cloudflare Access
 * Only works when CF_ACCESS_TEAM_DOMAIN is not configured (dev mode)
 */
export async function generateDevJWT(
  env: Bindings,
  email: string,
  name?: string
): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET || 'dev-secret');
  const now = Math.floor(Date.now() / 1000);

  // Mimic CF Access JWT payload structure
  const jwt = await new SignJWT({
    email,
    name: name || email.split('@')[0],
    custom: {
      dev_mode: true
    }
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(`dev-${email}`)
    .setIssuer('dev-local')
    .setAudience(['dev-local'])
    .setIssuedAt(now)
    .setExpirationTime(now + 86400 * 365) // 1 year
    .sign(secret);

  return jwt;
}

/**
 * Validate dev JWT (only in dev mode - no CF Access configured)
 */
export async function validateDevJWT(
  env: Bindings,
  token: string
): Promise<{ email: string; sub: string } | null> {
  // Only allow dev JWTs if CF Access is not configured
  if (env.CF_ACCESS_TEAM_DOMAIN || env.CF_ACCESS_AUD) {
    return null; // Production mode - use real CF Access
  }

  try {
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(env.JWT_SECRET || 'dev-secret');

    const { payload } = await jwtVerify(token, secret, {
      issuer: 'dev-local',
      audience: 'dev-local'
    });

    if (!payload.custom?.dev_mode) {
      return null; // Not a dev JWT
    }

    return {
      email: payload.email as string,
      sub: payload.sub as string
    };
  } catch (error) {
    return null;
  }
}
