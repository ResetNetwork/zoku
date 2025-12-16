// MCP OAuth 2.1 Provider Setup
// Uses Cloudflare's official workers-oauth-provider library
import { OAuthProvider } from '@cloudflare/workers-oauth-provider';
import type { Bindings } from '../types';

/**
 * Creates and configures MCP OAuth 2.1 provider
 * Handles: authorization, token exchange, refresh, client registration
 */
export function createMcpOAuthProvider(env: Bindings): OAuthProvider {
  if (!env.AUTH_KV) {
    throw new Error('AUTH_KV namespace required for OAuth');
  }

  if (!env.APP_URL) {
    throw new Error('APP_URL required for OAuth issuer');
  }

  return new OAuthProvider({
    kvNamespace: env.AUTH_KV,
    authorizeEndpoint: `${env.APP_URL}/oauth/authorize`,
    tokenEndpoint: `${env.APP_URL}/oauth/token`,
    registrationEndpoint: `${env.APP_URL}/oauth/register`,
    revocationEndpoint: `${env.APP_URL}/oauth/revoke`,
    issuer: env.APP_URL,
    scopesSupported: ['mcp'],
    supportedGrantTypes: ['authorization_code', 'refresh_token'],
    refreshTokenTTL: 2592000, // 30 days in seconds

    // Token exchange callback - update props during refresh
    tokenExchangeCallback: async (ctx) => {
      // User props stored during completeAuthorization()
      // Available in API handler as this.ctx.props
      return {
        accessTokenProps: ctx.props,
        newProps: ctx.props
      };
    },

    // Error handling
    onError: (error) => {
      console.error('[MCP OAuth Error]', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    }
  });
}
