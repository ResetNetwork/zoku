// Cloudflare Access JWT validation
import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { Bindings, CloudflareAccessPayload } from '../types';

/**
 * Validates Cloudflare Access JWT token
 * @throws {Error} if token is invalid or expired
 */
export async function validateCloudflareAccessToken(
  token: string,
  env: Bindings
): Promise<CloudflareAccessPayload> {
  if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) {
    throw new Error('CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD must be configured');
  }

  // Create JWKS fetcher (cached by jose)
  const JWKS = createRemoteJWKSet(
    new URL(`${env.CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`)
  );

  try {
    // Verify signature, issuer, audience, expiration
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: env.CF_ACCESS_TEAM_DOMAIN,
      audience: env.CF_ACCESS_AUD,
    });

    return payload as CloudflareAccessPayload;
  } catch (error) {
    throw new Error(`CF Access JWT validation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extracts JWT from request headers
 */
export function extractCloudflareAccessToken(request: Request): string | null {
  return request.headers.get('cf-access-jwt-assertion');
}
