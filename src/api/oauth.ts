// OAuth endpoints for Google Drive/Docs integration

import { Hono } from 'hono';
import type { Bindings } from '../types';

const app = new Hono<{ Bindings: Bindings }>();

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

  const redirectUri = `${new URL(c.req.url).origin}/api/oauth/google/callback`;

  // Generate state parameter for CSRF protection
  // Include both client_id and client_secret in state so callback can use them
  const state = JSON.stringify({
    nonce: crypto.randomUUID(),
    client_id,
    client_secret
  });

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', client_id);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', GOOGLE_OAUTH_SCOPES.join(' '));
  authUrl.searchParams.set('access_type', 'offline'); // Get refresh token
  authUrl.searchParams.set('prompt', 'consent'); // Force consent to get refresh token
  authUrl.searchParams.set('state', btoa(state)); // Base64 encode state

  return c.json({
    authorization_url: authUrl.toString(),
    state: btoa(state)
  });
});

// Handle OAuth callback - exchange code for tokens
app.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const error = c.req.query('error');
  const encodedState = c.req.query('state');

  if (error) {
    // Redirect to error page
    const errorUrl = new URL('/oauth-callback.html', new URL(c.req.url).origin);
    errorUrl.hash = `error=${encodeURIComponent(error)}`;
    return c.redirect(errorUrl.toString());
  }

  if (!code || !encodedState) {
    const errorUrl = new URL('/oauth-callback.html', new URL(c.req.url).origin);
    errorUrl.hash = 'error=missing_code_or_state';
    return c.redirect(errorUrl.toString());
  }

  // Decode state to get client_secret
  let stateData: any;
  try {
    stateData = JSON.parse(atob(encodedState));
  } catch (e) {
    const errorUrl = new URL('/oauth-callback.html', new URL(c.req.url).origin);
    errorUrl.hash = 'error=invalid_state';
    return c.redirect(errorUrl.toString());
  }

  const { client_secret } = stateData;
  const redirectUri = `${new URL(c.req.url).origin}/api/oauth/google/callback`;

  // We need to extract client_id from the original auth URL
  // Since we don't have it here, we'll need to get it from the query params Google sends back
  // Or we need to include it in the state

  // Actually, let's include client_id in the state as well
  const { client_id } = stateData;

  if (!client_id || !client_secret) {
    const errorUrl = new URL('/oauth-callback.html', new URL(c.req.url).origin);
    errorUrl.hash = 'error=missing_credentials_in_state';
    return c.redirect(errorUrl.toString());
  }

  // Exchange code for tokens
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id,
        client_secret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokens = await tokenResponse.json();

    if (!tokens.access_token) {
      throw new Error(`Token exchange failed: ${tokens.error_description || tokens.error}`);
    }

    // Redirect to backend callback page with tokens in URL hash
    const callbackUrl = new URL('/api/oauth/google/callback-page', new URL(c.req.url).origin);
    callbackUrl.hash = new URLSearchParams({
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      client_id,
      client_secret,
      expires_in: tokens.expires_in.toString(),
      scope: tokens.scope
    }).toString();

    return c.redirect(callbackUrl.toString());

  } catch (error) {
    console.error('OAuth token exchange failed:', error);
    return c.json({
      error: {
        code: 'TOKEN_EXCHANGE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to exchange authorization code for tokens'
      }
    }, 500);
  }
});

// Verify Google OAuth token (used for credential validation)
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

    const data = await response.json();

    if (!data.access_token) {
      throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
    }

    return c.json({
      valid: true,
      metadata: {
        token_type: data.token_type,
        scope: data.scope,
        expires_in: data.expires_in
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
