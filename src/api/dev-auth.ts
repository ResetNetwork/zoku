// Development Authentication Endpoints
// Provides JWT generation for local testing without Cloudflare Access
import { Hono } from 'hono';
import { generateDevJWT } from '../lib/dev-auth';
import type { Bindings } from '../types';

const app = new Hono<{ Bindings: Bindings }>();

// Generate dev JWT for testing
// Only works when CF_ACCESS_TEAM_DOMAIN is not configured
app.post('/login', async (c) => {
  // Only allow in dev mode
  if (c.env.CF_ACCESS_TEAM_DOMAIN || c.env.CF_ACCESS_AUD) {
    return c.json({ error: 'Dev endpoints disabled in production' }, 403);
  }

  const body = await c.req.json();
  const email = body.email;

  if (!email) {
    return c.json({ error: 'Email required' }, 400);
  }

  const jwt = await generateDevJWT(c.env, email, body.name);

  return c.json({
    token: jwt,
    instructions: {
      header: 'Authorization',
      value: `Bearer ${jwt}`,
      usage: 'Add to request headers for authenticated web UI access'
    }
  });
});

// Simple login page for browser testing
app.get('/login', async (c) => {
  // Only allow in dev mode
  if (c.env.CF_ACCESS_TEAM_DOMAIN || c.env.CF_ACCESS_AUD) {
    return c.json({ error: 'Dev endpoints disabled in production' }, 403);
  }

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dev Login - The Great Game</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #0a0e1a 0%, #1e1b4b 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #e5e7eb;
    }
    .card {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
      color: #fff;
    }
    .subtitle {
      font-size: 14px;
      color: #9ca3af;
      margin-bottom: 32px;
    }
    label {
      display: block;
      font-size: 14px;
      color: #d1d5db;
      margin-bottom: 8px;
    }
    input {
      width: 100%;
      padding: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      color: #fff;
      font-size: 16px;
      margin-bottom: 20px;
    }
    input:focus {
      outline: none;
      border-color: #6366f1;
    }
    button {
      width: 100%;
      padding: 14px;
      border: none;
      border-radius: 8px;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
    }
    .result {
      margin-top: 24px;
      padding: 16px;
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
      border-radius: 8px;
      display: none;
    }
    .result.show {
      display: block;
    }
    .token {
      font-family: monospace;
      font-size: 12px;
      word-break: break-all;
      color: #22c55e;
      margin-top: 8px;
    }
    .copy-btn {
      margin-top: 12px;
      padding: 8px 16px;
      width: auto;
      background: rgba(34, 197, 94, 0.2);
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Dev Login</h1>
    <p class="subtitle">Generate a test authentication token</p>

    <form id="loginForm">
      <label for="email">Email</label>
      <input
        type="email"
        id="email"
        placeholder="dev@reset.tech"
        value="dev@reset.tech"
        required
      />

      <label for="name">Name (optional)</label>
      <input
        type="text"
        id="name"
        placeholder="Dev User"
      />

      <button type="submit">Generate Token</button>
    </form>

    <div id="result" class="result">
      <p style="color: #22c55e; font-weight: 600; margin-bottom: 8px;">Token Generated!</p>
      <p style="font-size: 14px; color: #9ca3af; margin-bottom: 8px;">
        Use this as Authorization: Bearer header
      </p>
      <div class="token" id="token"></div>
      <button class="copy-btn" onclick="copyToken()">Copy to Clipboard</button>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 12px;">
        Or click below to auto-login:
      </p>
      <button class="copy-btn" onclick="autoLogin()">Login to Web UI</button>
    </div>
  </div>

  <script>
    let currentToken = '';

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('email').value;
      const name = document.getElementById('name').value;

      const response = await fetch('/dev/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name })
      });

      const data = await response.json();
      currentToken = data.token;

      document.getElementById('token').textContent = currentToken;
      document.getElementById('result').classList.add('show');
    });

    function copyToken() {
      navigator.clipboard.writeText(currentToken);
      alert('Token copied to clipboard!');
    }

    function autoLogin() {
      // Store token in sessionStorage
      sessionStorage.setItem('dev_auth_token', currentToken);
      // Redirect to app
      window.location.href = '/';
    }
  </script>
</body>
</html>`);
});

export default app;
