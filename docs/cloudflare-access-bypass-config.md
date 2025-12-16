# Cloudflare Access Bypass Configuration
**Date**: 2025-12-16  
**Status**: Required for Production Deployment

## Overview

As of 2025-12-16, **global authentication** has been implemented. All API endpoints now require Cloudflare Access JWT authentication, **except** for specific OAuth endpoints that must remain public for the MCP OAuth flow to work.

This document explains which paths need to be bypassed in your Cloudflare Access configuration.

---

## Why Bypass is Needed

### The Problem
MCP clients (like Claude Desktop) need to complete an OAuth flow before they have a JWT token. This creates a chicken-and-egg problem:
- OAuth discovery → needs to be public (client doesn't have token yet)
- Token exchange → needs to be public (client trading code for token)
- Authorization UI → needs CF Access (user interaction in browser)

### The Solution
Configure Cloudflare Access to **bypass** authentication for specific OAuth endpoints while protecting everything else.

---

## Paths That Need Bypass

Configure Cloudflare Access to **bypass** these exact paths:

### 1. Health Check
```
GET /health
```
**Reason**: Monitoring systems (uptime monitors, load balancers) don't have JWT.

### 2. OAuth Discovery  
```
GET /.well-known/oauth-authorization-server
```
**Reason**: MCP clients query this to discover OAuth endpoints before authentication.

### 3. Token Exchange
```
POST /oauth/token
```
**Reason**: Clients exchange authorization code for access token (happens after user approval but client still doesn't have JWT).

### 4. Client Registration
```
POST /oauth/register
```
**Reason**: Dynamic client registration (RFC 7591) - clients register themselves before OAuth flow.

### 5. Token Revocation
```
POST /oauth/revoke
```
**Reason**: Per RFC 7009, clients can revoke tokens without authentication (token itself proves identity).

---

## Paths That Stay Protected

These paths **must** require Cloudflare Access JWT:

### All API Endpoints
```
/api/*
```
**Protected**: All data access requires authentication.

### OAuth Authorization UI
```
GET /oauth/authorize
POST /oauth/authorize
```
**Protected**: User interaction in browser - CF Access provides the authentication.

### OAuth Session Management
```
GET /oauth/sessions
DELETE /oauth/sessions/:id
```
**Protected**: Account page features - user must be logged in.

### MCP Endpoint
```
POST /mcp
```
**Protected**: Has its own Bearer token authentication (OAuth access token or PAT).

### Frontend Assets
```
/*
```
**Protected**: Entire web UI requires CF Access.

---

## How to Configure Cloudflare Access

### Step 1: Create Access Application

1. Go to https://one.dash.cloudflare.com
2. Navigate to **Access** → **Applications**
3. Click **Add an application**
4. Choose **Self-hosted**

**Application Configuration:**
- **Name**: `Zoku - The Great Game`
- **Session Duration**: `24 hours`
- **Application Domain**: `zoku.205.dev`
- **Path**: Leave empty (protects entire domain)

### Step 2: Add Bypass Rules

In the same application configuration, add **Bypass** rules for public OAuth endpoints:

Click **Add a rule** and select **Bypass** for each of these:

#### Rule 1: Health Check
- **Rule name**: `Health Check`
- **Rule action**: **Bypass**
- **Path**: `/health`
- **Include**: `Everyone`

#### Rule 2: OAuth Discovery
- **Rule name**: `OAuth Discovery`
- **Rule action**: **Bypass**
- **Path**: `/.well-known/oauth-authorization-server`
- **Include**: `Everyone`

#### Rule 3: OAuth Token Exchange
- **Rule name**: `OAuth Token Exchange`
- **Rule action**: **Bypass**
- **Path**: `/oauth/token`
- **Include**: `Everyone`

#### Rule 4: OAuth Client Registration
- **Rule name**: `OAuth Client Registration`
- **Rule action**: **Bypass**
- **Path**: `/oauth/register`
- **Include**: `Everyone`

#### Rule 5: OAuth Token Revocation
- **Rule name**: `OAuth Token Revocation`
- **Rule action**: **Bypass**
- **Path**: `/oauth/revoke`
- **Include**: `Everyone`

### Step 3: Add Allow Rule for Web UI

After bypass rules, add an **Allow** rule for authenticated users:

- **Rule name**: `Authenticated Users`
- **Rule action**: **Allow**
- **Include**: Select your identity provider(s)
  - Example: `Emails ending in @your domain.com`
  - Or: `Google Workspace` (if using G Suite)
  - Or: `Email` (one-time passwords)

### Step 4: Save and Deploy

1. Click **Save application**
2. Test the configuration (see Testing section below)

---

## Rule Order Matters!

Cloudflare Access evaluates rules **in order**. The bypass rules must come **before** the allow rule:

```
1. Bypass: /health
2. Bypass: /.well-known/oauth-authorization-server
3. Bypass: /oauth/token
4. Bypass: /oauth/register
5. Bypass: /oauth/revoke
6. Allow: Authenticated users (your identity provider)
```

If a request matches a bypass rule, CF Access skips authentication. If not, it falls through to the allow rule and requires authentication.

---

## Testing the Configuration

### Test 1: Public Endpoints Work
```bash
# Health check (should return 200 without authentication)
curl https://zoku.205.dev/health

# OAuth discovery (should return JSON without authentication)
curl https://zoku.205.dev/.well-known/oauth-authorization-server

# Expected: Both should return data without 401/403 errors
```

### Test 2: Protected Endpoints Require Auth
```bash
# API endpoint (should return 401 without CF Access JWT)
curl https://zoku.205.dev/api/zoku

# Expected: 401 Unauthorized (or CF Access login page HTML)
```

### Test 3: OAuth Flow Works End-to-End
1. Configure MCP client (Claude Desktop) with server URL: `https://zoku.205.dev/mcp`
2. Client should auto-discover OAuth via `/.well-known/oauth-authorization-server`
3. Client should open browser to `/oauth/authorize` (you'll see CF Access login)
4. After login and approval, client should exchange code for token via `/oauth/token`
5. Client should successfully call `/mcp` with Bearer token

### Test 4: Web UI Requires Login
1. Open `https://zoku.205.dev` in browser (incognito mode)
2. Should see Cloudflare Access login page
3. After login, should see app dashboard

---

## Troubleshooting

### Problem: MCP OAuth fails with 401

**Symptom**: MCP client can't complete OAuth flow, gets 401 on `/oauth/token`

**Solution**: Check that `/oauth/token` has a **Bypass** rule in CF Access.

**Verify**:
```bash
curl -X POST https://zoku.205.dev/oauth/token \
  -d "grant_type=authorization_code"
# Should return error about missing parameters, NOT 401 authentication required
```

---

### Problem: Web UI shows "Authentication required"

**Symptom**: After CF Access login, web UI shows 401 error

**Possible causes**:
1. CF Access JWT not in `cf-access-jwt-assertion` header
2. Middleware expecting JWT but CF Access not sending it
3. AUD mismatch between CF Access and worker config

**Solution**: Check browser network tab:
- Request to `/api/zoku/me` should have `cf-access-jwt-assertion` header
- If missing, CF Access might not be configured correctly

**Verify worker config**:
```bash
# Check these secrets are set:
wrangler secret list

# Should show:
# CF_ACCESS_TEAM_DOMAIN
# CF_ACCESS_AUD
# JWT_SECRET
```

---

### Problem: OAuth authorization page requires double login

**Symptom**: User logs in via CF Access, then sees authorization page, but clicking "Authorize" prompts for login again

**Cause**: `/oauth/authorize` POST endpoint missing from CF Access configuration (has bypass rule instead of relying on session).

**Solution**: Ensure `POST /oauth/authorize` is NOT in bypass rules. It should fall through to the allow rule and use the CF Access session from the GET request.

---

### Problem: Health check fails in production

**Symptom**: Monitoring shows `/health` as down

**Solution**: Add `/health` to bypass rules in CF Access.

---

## Security Considerations

### Why These Endpoints Are Safe to Bypass

1. **`/health`** - Returns only `{"status": "ok"}`, no sensitive data
2. **`/.well-known/oauth-authorization-server`** - Returns public OAuth metadata, no secrets
3. **`/oauth/token`** - Requires valid authorization code + PKCE verifier (security built-in)
4. **`/oauth/register`** - Only creates client IDs, doesn't grant access
5. **`/oauth/revoke`** - Token revocation is safe (idempotent, requires valid token)

### What's Still Protected

- **All data access** (`/api/*`) requires CF Access JWT
- **User interaction** (`/oauth/authorize`) requires CF Access login
- **MCP operations** (`/mcp`) require Bearer token (OAuth or PAT)
- **Frontend assets** (`/*`) require CF Access login

### Defense in Depth

Even with bypass rules, the application has multiple security layers:
1. **API routes**: Global `authMiddleware()` checks CF Access JWT
2. **Tier checks**: `requireTier()` enforces permission levels
3. **MCP endpoint**: Separate Bearer token authentication
4. **OAuth flow**: PKCE prevents authorization code interception
5. **Audit logging**: All sensitive operations logged

---

## Summary

**Configure Cloudflare Access to bypass these 5 paths:**
1. `GET /health`
2. `GET /.well-known/oauth-authorization-server`
3. `POST /oauth/token`
4. `POST /oauth/register`
5. `POST /oauth/revoke`

**Everything else requires CF Access authentication.**

This configuration allows:
- ✅ MCP OAuth flow to complete (public endpoints work)
- ✅ Web UI protected (CF Access required)
- ✅ API protected (CF Access JWT required)
- ✅ Monitoring works (health check public)

**After deployment, test all three flows:**
1. Web UI login (should require CF Access)
2. MCP OAuth connection (should work end-to-end)
3. API access without JWT (should return 401)
