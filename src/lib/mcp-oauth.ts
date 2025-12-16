// MCP OAuth 2.1 Server Implementation
// Manual implementation using jose + KV (simpler than @cloudflare/workers-oauth-provider)
import { SignJWT, jwtVerify } from 'jose';
import type { Bindings } from '../types';
import * as crypto from 'crypto';

// OAuth token storage keys in KV
const OAUTH_CODE_PREFIX = 'oauth:code:';
const OAUTH_ACCESS_PREFIX = 'oauth:access:';
const OAUTH_REFRESH_PREFIX = 'oauth:refresh:';
const OAUTH_CLIENT_PREFIX = 'oauth:client:';

export interface OAuthAuthorizationCode {
  code: string;
  client_id: string;
  redirect_uri: string;
  user_id: string;
  tier: string;
  code_challenge: string;
  scope: string;
  expires_at: number;
}

export interface OAuthAccessToken {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface OAuthClient {
  client_id: string;
  client_secret?: string;
  redirect_uris: string[];
  client_name: string;
  grant_types: string[];
}

/**
 * Generate authorization code and store in KV
 */
export async function createAuthorizationCode(
  env: Bindings,
  params: {
    client_id: string;
    redirect_uri: string;
    user_id: string;
    tier: string;
    code_challenge: string;
    scope: string;
  }
): Promise<string> {
  const code = `code_${crypto.randomUUID().replace(/-/g, '')}`;
  const expiresAt = Math.floor(Date.now() / 1000) + 600; // 10 minutes

  const authCode: OAuthAuthorizationCode = {
    code,
    ...params,
    expires_at: expiresAt
  };

  // Store in KV with 10-minute TTL
  await env.AUTH_KV.put(
    `${OAUTH_CODE_PREFIX}${code}`,
    JSON.stringify(authCode),
    { expirationTtl: 600 }
  );

  return code;
}

/**
 * Exchange authorization code for access token (with PKCE verification)
 */
export async function exchangeCodeForToken(
  env: Bindings,
  code: string,
  code_verifier: string,
  client_id: string,
  redirect_uri: string
): Promise<OAuthAccessToken> {
  // Retrieve authorization code from KV
  const storedData = await env.AUTH_KV.get(`${OAUTH_CODE_PREFIX}${code}`, 'json') as OAuthAuthorizationCode | null;

  if (!storedData) {
    throw new Error('Invalid or expired authorization code');
  }

  // Verify client_id and redirect_uri match
  if (storedData.client_id !== client_id || storedData.redirect_uri !== redirect_uri) {
    throw new Error('Client mismatch');
  }

  // Verify PKCE code_challenge
  const computedChallenge = await computeCodeChallenge(code_verifier);
  if (computedChallenge !== storedData.code_challenge) {
    throw new Error('Invalid code_verifier');
  }

  // Delete used authorization code (one-time use)
  await env.AUTH_KV.delete(`${OAUTH_CODE_PREFIX}${code}`);

  // Generate access token (JWT)
  const accessTokenId = `at_${crypto.randomUUID().replace(/-/g, '')}`;
  const refreshTokenId = `rt_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 3600; // 1 hour

  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const accessToken = await new SignJWT({
    scope: storedData.scope,
    tier: storedData.tier,
    token_type: 'oauth'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(storedData.user_id)
    .setJti(accessTokenId)
    .setIssuedAt(now)
    .setExpirationTime(now + expiresIn)
    .sign(secret);

  // Generate refresh token (JWT)
  const refreshToken = await new SignJWT({
    access_token_id: accessTokenId,
    token_type: 'oauth_refresh'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(storedData.user_id)
    .setJti(refreshTokenId)
    .setIssuedAt(now)
    .setExpirationTime(now + 2592000) // 30 days
    .sign(secret);

  // Store token metadata in KV
  await env.AUTH_KV.put(
    `${OAUTH_ACCESS_PREFIX}${accessTokenId}`,
    JSON.stringify({ user_id: storedData.user_id, tier: storedData.tier, scope: storedData.scope }),
    { expirationTtl: expiresIn }
  );

  await env.AUTH_KV.put(
    `${OAUTH_REFRESH_PREFIX}${refreshTokenId}`,
    JSON.stringify({ user_id: storedData.user_id, tier: storedData.tier, scope: storedData.scope }),
    { expirationTtl: 2592000 }
  );

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    refresh_token: refreshToken,
    scope: storedData.scope
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  env: Bindings,
  refreshToken: string
): Promise<OAuthAccessToken> {
  // Verify refresh token
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const { payload } = await jwtVerify(refreshToken, secret);

  const refreshTokenId = payload.jti as string;
  const userId = payload.sub as string;

  // Check if refresh token is revoked
  const tokenData = await env.AUTH_KV.get(`${OAUTH_REFRESH_PREFIX}${refreshTokenId}`, 'json') as any;
  if (!tokenData) {
    throw new Error('Invalid or expired refresh token');
  }

  // Generate new access token
  const accessTokenId = `at_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 3600; // 1 hour

  const accessToken = await new SignJWT({
    scope: tokenData.scope,
    tier: tokenData.tier,
    token_type: 'oauth'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setJti(accessTokenId)
    .setIssuedAt(now)
    .setExpirationTime(now + expiresIn)
    .sign(secret);

  // Store new access token metadata
  await env.AUTH_KV.put(
    `${OAUTH_ACCESS_PREFIX}${accessTokenId}`,
    JSON.stringify({ user_id: userId, tier: tokenData.tier, scope: tokenData.scope }),
    { expirationTtl: expiresIn }
  );

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    scope: tokenData.scope
  };
}

/**
 * Validate OAuth access token and return user props
 */
export async function validateOAuthToken(
  env: Bindings,
  token: string
): Promise<{ user_id: string; tier: string } | null> {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    // Check if it's an OAuth token
    if (payload.token_type !== 'oauth') {
      return null;
    }

    const tokenId = payload.jti as string;
    const userId = payload.sub as string;

    // Verify token exists in KV (not revoked)
    const tokenData = await env.AUTH_KV.get(`${OAUTH_ACCESS_PREFIX}${tokenId}`, 'json');
    if (!tokenData) {
      throw new Error('Token revoked or expired');
    }

    return {
      user_id: userId,
      tier: payload.tier as string
    };
  } catch (error) {
    return null;
  }
}

/**
 * Register a new OAuth client (RFC 7591)
 */
export async function registerClient(
  env: Bindings,
  params: {
    client_name: string;
    redirect_uris: string[];
    grant_types?: string[];
  }
): Promise<OAuthClient> {
  const clientId = `client_${crypto.randomUUID().replace(/-/g, '')}`;
  const clientSecret = crypto.randomUUID();

  const client: OAuthClient = {
    client_id: clientId,
    client_secret: clientSecret,
    client_name: params.client_name,
    redirect_uris: params.redirect_uris,
    grant_types: params.grant_types || ['authorization_code', 'refresh_token']
  };

  await env.AUTH_KV.put(
    `${OAUTH_CLIENT_PREFIX}${clientId}`,
    JSON.stringify(client)
  );

  return client;
}

/**
 * Get OAuth client by ID
 */
export async function getClient(
  env: Bindings,
  clientId: string
): Promise<OAuthClient | null> {
  const client = await env.AUTH_KV.get(`${OAUTH_CLIENT_PREFIX}${clientId}`, 'json');
  return client as OAuthClient | null;
}

/**
 * Compute SHA-256 PKCE code challenge from verifier
 */
async function computeCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const base64 = btoa(String.fromCharCode(...hashArray));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Revoke OAuth token
 */
export async function revokeOAuthToken(
  env: Bindings,
  token: string
): Promise<void> {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    const tokenId = payload.jti as string;
    const tokenType = payload.token_type as string;

    if (tokenType === 'oauth') {
      await env.AUTH_KV.delete(`${OAUTH_ACCESS_PREFIX}${tokenId}`);
    } else if (tokenType === 'oauth_refresh') {
      await env.AUTH_KV.delete(`${OAUTH_REFRESH_PREFIX}${tokenId}`);
    }
  } catch (error) {
    // Token already invalid or expired
  }
}
