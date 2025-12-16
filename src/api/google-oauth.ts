// OAuth endpoints for Google Drive/Docs integration
// Now using Arctic library for OAuth 2.1 compliance with PKCE

import { Hono } from 'hono';
import { Google, generateState, generateCodeVerifier } from 'arctic';
import type { HonoEnv, Bindings } from '../types';

const app = new Hono<HonoEnv>();

// Google OAuth configuration
const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/documents.readonly'
];

// Serve OAuth callback HTML page
app.get('/google/callback-page', async (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OAuth Callback</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      align-items: center;
      justify-center;
      height: 100vh;
      margin: 0;
      background: #0a0e1a;
      color: #fff;
    }
    .message {
      text-align: center;
    }
    .spinner {
      border: 3px solid #374151;
      border-top: 3px solid #6366f1;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="message">
    <div class="spinner"></div>
    <h2>Completing authorization...</h2>
    <p>You can close this window.</p>
  </div>

  <script>
    console.log('📄 OAuth callback page loaded');
    console.log('📍 Current URL:', window.location.href);
    console.log('🔗 URL hash:', window.location.hash);

    // Extract tokens from URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const tokens = {
      refresh_token: hashParams.get('refresh_token'),
      access_token: hashParams.get('access_token'),
      client_id: hashParams.get('client_id'),
      client_secret: hashParams.get('client_secret'),
      expires_in: hashParams.get('expires_in'),
      scope: hashParams.get('scope'),
      error: hashParams.get('error')
    };

    console.log('🎫 Extracted tokens:', {
      has_refresh_token: !!tokens.refresh_token,
      has_access_token: !!tokens.access_token,
      has_client_id: !!tokens.client_id,
      has_client_secret: !!tokens.client_secret,
      refresh_token_length: tokens.refresh_token?.length,
      client_id: tokens.client_id,
      error: tokens.error
    });

    // Send tokens to parent window
    // Use '*' for origin during development (frontend is on different port)
    // In production, both will be on same origin
    if (window.opener) {
      console.log('👪 Parent window exists, sending tokens...');
      console.log('📤 Sending postMessage with type: google-oauth-callback');

      window.opener.postMessage({
        type: 'google-oauth-callback',
        tokens
      }, '*');  // Allow cross-origin between dev servers

      console.log('✅ postMessage sent successfully');

      // Update UI to show success
      document.querySelector('.message').innerHTML =
        '<div style="text-align: center;">' +
        '<svg style="width: 64px; height: 64px; margin: 0 auto 20px; color: #22c55e;" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>' +
        '</svg>' +
        '<h2 style="color: #22c55e; margin-bottom: 12px;">Authorization Successful!</h2>' +
        '<p style="color: #9ca3af;">You can close this window, or it will close automatically in 5 seconds.</p>' +
        '</div>';

      // Close popup after 5 seconds
      setTimeout(() => {
        console.log('🚪 Closing popup window...');
        window.close();
      }, 5000);
    } else {
      console.error('❌ No parent window (window.opener is null)');
      document.querySelector('.message').innerHTML =
        '<h2>Authorization Complete</h2><p>Please close this window and return to the app.</p>';
    }
  </script>
</body>
</html>`;

  return c.html(html);
});

// Start OAuth flow - requires client_id from user's Google Cloud project
// Arctic automatically handles PKCE (OAuth 2.1 requirement)
app.post('/google/authorize', async (c) => {
  const body = await c.req.json();
  const { client_id, client_secret } = body;

  if (!client_id || !client_secret) {
    return c.json({
      error: {
        code: 'MISSING_CREDENTIALS',
        message: 'client_id and client_secret are required'
      }
    }, 400);
  }

  // Determine scopes and credentials to use
  let scopes = GOOGLE_OAUTH_SCOPES; // Default fallback
  let actualClientId = client_id;
  let actualClientSecret = client_secret;

  // If using server-side OAuth app (signaled by special value), fetch from OAuth app
  if (client_secret === '[USE_SERVER_CONFIG]') {
    try {
      // Fetch OAuth application for Google to get configured scopes and credentials
      const oauthAppResult = await c.env.DB
        .prepare('SELECT client_id, client_secret, scopes FROM oauth_applications WHERE provider = ? ORDER BY created_at DESC LIMIT 1')
        .bind('google')
        .first();

      if (!oauthAppResult) {
        return c.json({
          error: {
            code: 'NO_OAUTH_APP',
            message: 'No Google OAuth application configured. Ask admin to configure in Settings.'
          }
        }, 400);
      }

      // Use credentials and scopes from OAuth application
      actualClientId = oauthAppResult.client_id as string;
      actualClientSecret = oauthAppResult.client_secret as string; // Still encrypted - need to decrypt!
      scopes = JSON.parse(oauthAppResult.scopes as string);
      
      // Decrypt the client_secret
      const { decryptJewel } = await import('../lib/crypto');
      actualClientSecret = await decryptJewel(actualClientSecret, c.env.ENCRYPTION_KEY);
      
      console.log('Using OAuth application:', { client_id: actualClientId, scopes });
    } catch (error) {
      console.error('Failed to fetch OAuth application:', error);
      return c.json({
        error: {
          code: 'OAUTH_APP_ERROR',
          message: 'Failed to fetch OAuth application configuration'
        }
      }, 500);
    }
  }

  const redirectUri = `${new URL(c.req.url).origin}/api/oauth/google/callback`;

  // Initialize Arctic Google provider with actual credentials
  const google = new Google(actualClientId, actualClientSecret, redirectUri);

  // Generate state and code_verifier for PKCE
  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  // Store credentials and code_verifier in state for callback
  const stateData = JSON.stringify({
    nonce: state,
    client_id,
    client_secret,
    code_verifier: codeVerifier
  });

  // Arctic automatically adds PKCE parameters (code_challenge, code_challenge_method)
  // and configures for offline access (refresh token)
  const authUrl = google.createAuthorizationURL(
    state,
    codeVerifier,
    scopes // Use dynamic scopes from OAuth application
  );

  // Add extra parameters for refresh token
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  return c.json({
    authorization_url: authUrl.toString(),
    state: btoa(stateData)
  });
});

// Handle OAuth callback - Arctic validates PKCE and exchanges code for tokens
app.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const error = c.req.query('error');
  const encodedState = c.req.query('state');

  if (error) {
    // Redirect to error page
    const errorUrl = new URL('/api/oauth/google/callback-page', new URL(c.req.url).origin);
    errorUrl.hash = `error=${encodeURIComponent(error)}`;
    return c.redirect(errorUrl.toString());
  }

  if (!code || !encodedState) {
    const errorUrl = new URL('/api/oauth/google/callback-page', new URL(c.req.url).origin);
    errorUrl.hash = 'error=missing_code_or_state';
    return c.redirect(errorUrl.toString());
  }

  // Decode state to get credentials and code_verifier
  let stateData: any;
  try {
    stateData = JSON.parse(atob(encodedState));
  } catch (e) {
    const errorUrl = new URL('/api/oauth/google/callback-page', new URL(c.req.url).origin);
    errorUrl.hash = 'error=invalid_state';
    return c.redirect(errorUrl.toString());
  }

  const { client_id, client_secret, code_verifier } = stateData;

  if (!client_id || !client_secret || !code_verifier) {
    const errorUrl = new URL('/api/oauth/google/callback-page', new URL(c.req.url).origin);
    errorUrl.hash = 'error=missing_credentials_in_state';
    return c.redirect(errorUrl.toString());
  }

  const redirectUri = `${new URL(c.req.url).origin}/api/oauth/google/callback`;

  // Arctic validates PKCE and exchanges code for tokens
  try {
    const google = new Google(client_id, client_secret, redirectUri);

    // validateAuthorizationCode automatically:
    // 1. Validates the PKCE code_verifier against the challenge
    // 2. Exchanges the authorization code for tokens
    // 3. Returns { access_token, refresh_token, expires_in, ... }
    const tokens = await google.validateAuthorizationCode(code, code_verifier);

    // Redirect to backend callback page with tokens in URL hash
    const callbackUrl = new URL('/api/oauth/google/callback-page', new URL(c.req.url).origin);
    
    // Arctic library uses method properties - call them and ensure string types
    const refreshToken: string = typeof tokens.refreshToken === 'function' ? tokens.refreshToken() : tokens.refreshToken;
    const accessToken: string = typeof tokens.accessToken === 'function' ? tokens.accessToken() : tokens.accessToken;
    const expiresAt: Date | undefined = typeof tokens.accessTokenExpiresAt === 'function' ? tokens.accessTokenExpiresAt() : tokens.accessTokenExpiresAt;
    const scopes: string[] = typeof tokens.scopes === 'function' ? tokens.scopes() : tokens.scopes;
    
    const expiresIn = expiresAt ?
      Math.floor((expiresAt.getTime() - Date.now()) / 1000).toString() :
      '3600';
    const scopeString = Array.isArray(scopes) ? scopes.join(' ') : GOOGLE_OAUTH_SCOPES.join(' ');
    
    callbackUrl.hash = new URLSearchParams({
      refresh_token: refreshToken || '',
      access_token: accessToken,
      client_id,
      client_secret,
      expires_in: expiresIn,
      scope: scopeString
    }).toString();

    return c.redirect(callbackUrl.toString());

  } catch (error) {
    console.error('OAuth token exchange failed:', error);
    const errorUrl = new URL('/api/oauth/google/callback-page', new URL(c.req.url).origin);
    errorUrl.hash = `error=${encodeURIComponent(error instanceof Error ? error.message : 'Token exchange failed')}`;
    return c.redirect(errorUrl.toString());
  }
});

// Verify Google OAuth token (used for jewel validation)
app.post('/google/verify', async (c) => {
  const body = await c.req.json();
  const { refresh_token, client_id, client_secret } = body;

  if (!refresh_token || !client_id || !client_secret) {
    return c.json({
      error: {
        code: 'MISSING_CREDENTIALS',
        message: 'Missing required fields: refresh_token, client_id, client_secret'
      }
    }, 400);
  }

  try {
    // Try to refresh the token to verify it works
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id,
        client_secret,
        refresh_token,
        grant_type: 'refresh_token'
      })
    });

    const data = await response.json() as any;

    if (!data.access_token) {
      throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
    }

    return c.json({
      valid: true,
      metadata: {
        token_type: data.token_type as string,
        scope: data.scope as string,
        expires_in: data.expires_in as number
      }
    });

  } catch (error) {
    return c.json({
      valid: false,
      error: error instanceof Error ? error.message : 'Token verification failed'
    }, 400);
  }
});

export default app;
