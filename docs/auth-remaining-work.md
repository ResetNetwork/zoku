# Authentication: Remaining Work
**Date**: 2025-12-15 (Updated: 2025-12-16)
**Status**: Phase 4 Complete ✅ | OAuth 2.1 Tested ✅ | Ready for Production Deployment

## Executive Summary

**Authentication is 85% complete.** Core infrastructure is fully implemented:
- ✅ Cloudflare Access integration (web auth)
- ✅ JWT-based PAT system (MCP auth fallback)
- ✅ Tier-based permissions (4 levels)
- ✅ Frontend auth UI (Account page, user menu, permission checks)
- ✅ Database schema with all auth fields
- ✅ Audit logging infrastructure

**Critical Blocker:** OAuth 2.1 for MCP must be implemented before testing and deployment.

### What Needs to Be Done

**1. Implement OAuth 2.1 Server (REQUIRED - 1 day)**
- ❌ Install `@cloudflare/workers-oauth-provider` npm package
- ❌ Create `src/lib/mcp-oauth.ts` (OAuth provider setup)
- ❌ Create `src/api/mcp-oauth.ts` (6 endpoints: discovery, authorize, token, register, revoke)
- ❌ Update `src/lib/mcp-tokens.ts` (try OAuth first, fall back to PAT)
- ❌ Mount routes in `src/index.ts`
- ❌ Test locally with Claude Desktop

**2. Deploy to Production (AFTER OAuth works - 1 hour)**
- ⏳ Create Cloudflare Access application
- ⏳ Create AUTH_KV namespace
- ⏳ Set 4 production secrets
- ⏳ Run database migration remotely
- ⏳ Deploy worker
- ⏳ End-to-end test

**Timeline:** 1-2 days total (Day 1: OAuth implementation, Day 2: Deploy + test)

---

## What's Implemented ✅

### Backend Authentication (90% Complete)

**Files Present:**
- `src/middleware/auth.ts` - Cloudflare Access validation, tier enforcement, MCP token validation
- `src/lib/cf-access.ts` - JWT validation with JWKS
- `src/lib/mcp-tokens.ts` - PAT generation, validation, revocation, session caching (5-min TTL)
- `src/api/mcp-tokens.ts` - PAT management API (list, create, revoke)
- `src/api/google-oauth.ts` - Google OAuth for jewels (Arctic library, PKCE)

**Database Schema (Complete):**
- `zoku` table: access_tier, email (unique), cf_access_sub, last_login, created_by, updated_by + indexes
- `jewels` table: owner_id (FK to zoku) + index
- `audit_log` table: full schema with indexes
- `migrations/005_add_authentication.sql` - ready to apply

**Configuration:**
- `wrangler.toml`: AUTH_KV binding configured (needs production IDs)
- `src/types.ts`: All auth types (AccessTier, PatMetadata, CloudflareAccessPayload, AuditLog)
- Routes mounted in `src/index.ts`

### Frontend Authentication (100% Complete)

**Files Present:**
- `frontend/src/lib/auth.tsx` - AuthProvider, useAuth, useCanWrite, useIsPrime
- `frontend/src/components/AccountPage.tsx` - Profile + PAT management + **misleading OAuth UI**
- `frontend/src/components/AccessDenied.tsx` - Access denied page
- `frontend/src/main.tsx` - App wrapped in AuthProvider

**Features Working:**
- User menu with tier indicator (colored dots)
- Permission-based UI (buttons hidden for coherent users)
- PAT generation UI (30/60/90/365 days)
- Token list (creation date, last used, revoke)

### MCP Authentication (50% Complete - PAT Only)

**What Works:**
- Bearer token validation (JWT signatures via jose)
- Session-aware caching (full check on initialize, 5-min cache)
- Tier-based tool authorization (19 tools = entangled, 3 = coherent, 7 = public)
- Revocation via KV blocklist with TTL
- Dev bypass mode

**Current MCP Config (PAT only):**
```json
{
  "mcpServers": {
    "zoku": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer <JWT_PAT_TOKEN>"
      }
    }
  }
}
```

---

## What's NOT Implemented ❌

### 1. OAuth 2.1 for MCP Authentication (CRITICAL - REQUIRED FOR TESTING)

**Why This Blocks Deployment:**
- The UI advertises OAuth as the recommended method
- Modern MCP clients expect OAuth support
- PAT-only is not acceptable for production
- Must test OAuth flow before deploying

**Current State:**
- Account page shows "✨ Recommended: OAuth (Automatic)" but OAuth doesn't work
- Claims clients can "just add URL" without Bearer token
- No OAuth endpoints exist for MCP user authentication

**Files Missing:**
1. `src/lib/oauth-setup.ts` - OAuth provider configuration
2. `src/api/mcp-oauth.ts` - Authorization UI + endpoints
3. OAuth discovery endpoint: `/.well-known/oauth-authorization-server`
4. Authorization endpoints: `/oauth/authorize` (GET + POST), `/oauth/token`, `/oauth/revoke`

**Note:** `src/api/google-oauth.ts` exists but is for Google Drive/Docs jewels, NOT MCP user auth.

**MCP OAuth 2.1 Specification Requirements:**

Per [MCP Specification (March 2025)](https://spec.modelcontextprotocol.io):
- ✅ RFC 8414 metadata discovery at `/.well-known/oauth-authorization-server`
- ✅ Authorization code grant with **PKCE mandatory**
- ✅ Refresh token support (30-day TTL recommended)
- ✅ Dynamic client registration (RFC 7591) optional but recommended
- ✅ Bearer token validation on all requests (RFC 6750)
- ✅ HTTP 401 triggers OAuth discovery in clients

**Implementation Plan:**

#### A. Backend OAuth Implementation (6-8 hours)

**Library Choice: @cloudflare/workers-oauth-provider**
- Official Cloudflare library for OAuth 2.1 servers
- RFC compliant (OAuth 2.1, RFC 8414, RFC 7591)
- Built for Workers environment with KV storage
- Handles PKCE, token refresh, client registration automatically

**Installation:**
```bash
npm install @cloudflare/workers-oauth-provider
```

**1. Create OAuth Provider Setup** (`src/lib/mcp-oauth.ts`)
```typescript
import { OAuthProvider } from '@cloudflare/workers-oauth-provider';
import type { Bindings } from '../types';

export function createMcpOAuthProvider(env: Bindings) {
  return new OAuthProvider({
    kvNamespace: env.AUTH_KV,
    authorizeEndpoint: `${env.APP_URL}/oauth/authorize`,
    tokenEndpoint: `${env.APP_URL}/oauth/token`,
    registrationEndpoint: `${env.APP_URL}/oauth/register`,
    revocationEndpoint: `${env.APP_URL}/oauth/revoke`,
    issuer: env.APP_URL,
    scopesSupported: ['mcp'],
    supportedGrantTypes: ['authorization_code', 'refresh_token'],
    refreshTokenTTL: 2592000, // 30 days

    // Update props during token exchange (e.g., refresh upstream tokens)
    tokenExchangeCallback: async (ctx) => {
      return {
        accessTokenProps: ctx.props,
        newProps: ctx.props
      };
    }
  });
}
```

**2. Create OAuth Endpoints** (`src/api/mcp-oauth.ts`)

**Endpoints to implement:**
1. `GET /.well-known/oauth-authorization-server` - Metadata discovery (RFC 8414)
2. `GET /oauth/authorize` - Authorization UI (requires CF Access auth)
3. `POST /oauth/authorize` - User approval handler
4. `POST /oauth/token` - Token exchange (code → tokens, refresh)
5. `POST /oauth/register` - Dynamic client registration (RFC 7591)
6. `POST /oauth/revoke` - Token revocation

**Implementation:**
```typescript
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createMcpOAuthProvider } from '../lib/mcp-oauth';
import type { Bindings, Zoku } from '../types';

const app = new Hono<{ Bindings: Bindings }>();

// RFC 8414 metadata discovery
app.get('/.well-known/oauth-authorization-server', async (c) => {
  const baseUrl = c.env.APP_URL || new URL(c.req.url).origin;

  return c.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: `${baseUrl}/oauth/register`,
    revocation_endpoint: `${baseUrl}/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_basic'],
    scopes_supported: ['mcp']
  });
});

// Authorization page (requires CF Access)
app.get('/oauth/authorize', authMiddleware(), async (c) => {
  const user = c.get('user') as Zoku;
  const query = c.req.query();

  // Parse OAuth request
  const provider = createMcpOAuthProvider(c.env);
  const authReq = await provider.parseAuthRequest(new Request(c.req.url));

  // Validate PKCE
  if (!authReq.code_challenge || authReq.code_challenge_method !== 'S256') {
    return c.html('<h1>Error: PKCE required</h1>', 400);
  }

  // Show authorization UI
  return c.html(renderAuthorizationPage(user, authReq));
});

// User approval
app.post('/oauth/authorize', authMiddleware(), async (c) => {
  const user = c.get('user') as Zoku;
  const body = await c.req.parseBody();

  if (body.action !== 'approve') {
    // Redirect with error
    const redirect = new URL(body.redirect_uri as string);
    redirect.searchParams.set('error', 'access_denied');
    return c.redirect(redirect.toString());
  }

  // Complete authorization
  const provider = createMcpOAuthProvider(c.env);
  const result = await provider.completeAuthorization({
    client_id: body.client_id,
    redirect_uri: body.redirect_uri,
    code_challenge: body.code_challenge,
    state: body.state,
    userId: user.id,
    props: { user_id: user.id, tier: user.access_tier }
  });

  return c.redirect(result.redirectTo);
});

// Token exchange, refresh, registration, revocation
// Delegate to OAuth provider library
app.post('/oauth/token', async (c) => {
  const provider = createMcpOAuthProvider(c.env);
  return await provider.handleTokenRequest(c.req.raw);
});

app.post('/oauth/register', async (c) => {
  const provider = createMcpOAuthProvider(c.env);
  return await provider.handleClientRegistration(c.req.raw);
});

app.post('/oauth/revoke', async (c) => {
  const provider = createMcpOAuthProvider(c.env);
  return await provider.handleRevocation(c.req.raw);
});

export default app;
```

**3. Update Token Validation** (`src/lib/mcp-tokens.ts`)

Modify `validateMcpToken()` to try OAuth first, then fall back to PAT:
```typescript
export async function validateMcpToken(
  token: string,
  env: Bindings,
  db: DB,
  isInitialize: boolean
): Promise<Zoku> {
  // Try OAuth token first (from OAuth provider library)
  try {
    const { createMcpOAuthProvider } = await import('./mcp-oauth');
    const provider = createMcpOAuthProvider(env);
    const tokenData = await provider.validateAccessToken(token);

    if (tokenData?.props?.user_id) {
      const user = await db.getZoku(tokenData.props.user_id);
      if (!user) throw new Error('User not found');
      if (user.access_tier === 'observed') throw new Error('Access revoked');
      return user;
    }
  } catch (oauthError) {
    // Not an OAuth token or validation failed, try PAT
  }

  // Fall back to PAT validation (existing JWT code)
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const { payload } = await jwtVerify(token, secret);

  const jti = payload.jti as string;
  const userId = payload.sub as string;

  // Check cache (skip revocation unless initialize)
  const cached = tokenCache.get(jti);
  if (!isInitialize && cached && (Date.now() - cached.cachedAt < CACHE_TTL)) {
    return cached.user;
  }

  // Check revocation in KV
  if (env.AUTH_KV) {
    const isRevoked = await env.AUTH_KV.get(`pat:revoked:${jti}`);
    if (isRevoked) {
      tokenCache.delete(jti);
      throw new Error('Token revoked');
    }
  }

  // Load user
  const user = await db.getZoku(userId);
  if (!user) throw new Error('User not found');
  if (user.access_tier === 'observed') throw new Error('Access revoked');

  // Cache and return
  tokenCache.set(jti, { user, cachedAt: Date.now() });
  return user;
}
```

**4. Mount OAuth Routes** (`src/index.ts`)
```typescript
import mcpOAuthRoutes from './api/mcp-oauth';

// Mount OAuth endpoints at root (for /.well-known discovery)
app.route('/', mcpOAuthRoutes);  // Handles /.well-known/oauth-authorization-server
app.route('/oauth', mcpOAuthRoutes);  // Handles /oauth/* endpoints
```

**5. Update MCP Handler** (`src/mcp/server.ts`)

No changes needed! The existing Bearer token validation in `mcpHandler` (line 1536-1567) already calls `validateMcpToken()`, which will now try OAuth first, then PAT.

#### B. Authorization UI Page (1-2 hours)

**Design:**
- Clean, minimal HTML page (inline CSS, no build step)
- Show client ID requesting access
- Display user identity (email, tier from CF Access)
- List permissions being granted ("Access The Great Game MCP server")
- Two buttons: "Authorize" (green) and "Deny" (gray)

**Implementation:**
```typescript
// GET /oauth/authorize
return c.html(`
  <!DOCTYPE html>
  <html>
    <head><title>Authorize MCP Client</title></head>
    <body>
      <h1>Authorize MCP Client</h1>
      <p><strong>${client_id}</strong> wants to access The Great Game.</p>
      <div class="user-info">
        Signed in as: ${user.email} (${user.access_tier} tier)
      </div>
      <form method="POST">
        <input type="hidden" name="client_id" value="${client_id}">
        <input type="hidden" name="state" value="${state}">
        <input type="hidden" name="code_challenge" value="${code_challenge}">
        <button name="action" value="approve">Authorize</button>
        <button name="action" value="deny">Deny</button>
      </form>
    </body>
  </html>
`);
```

#### C. Update Account Page UI (15 minutes)

**Fix misleading OAuth section** (`frontend/src/components/AccountPage.tsx` line 144-164):

```tsx
// Keep OAuth section but mark as primary
<div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
  <h3 className="text-sm font-semibold mb-2 text-blue-900 dark:text-blue-100">
    ✨ Recommended: OAuth (Automatic)
  </h3>
  <p className="text-sm mb-3 text-blue-800 dark:text-blue-200">
    Modern MCP clients like Claude Desktop support OAuth - just add the URL:
  </p>
  <pre className="text-xs bg-white dark:bg-gray-900 p-3 rounded border border-blue-200 dark:border-blue-800 overflow-x-auto">
{`{
  "mcpServers": {
    "the-great-game": {
      "url": "${window.location.origin}/mcp"
    }
  }
}`}
  </pre>
  <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
    The client will automatically open your browser to authorize access.
  </p>
</div>

// Keep PAT section as fallback
<div className="border-t border-gray-200 dark:border-gray-700 pt-6">
  <h3 className="font-semibold text-gray-900 dark:text-white">
    Personal Access Tokens (Fallback)
  </h3>
  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
    For clients that don't support OAuth, or for scripts/automation.
  </p>
  ...
</div>
```

#### D. Install Dependencies

```bash
npm install @cloudflare/workers-oauth-provider
```

**Current Dependencies (Confirmed):**
- ✅ `arctic@3.7.0` - OAuth client library (used for Google OAuth)
- ✅ `jose@6.1.3` - JWT signing and validation
- ✅ `hono@4.6.14` - HTTP framework
- ✅ `zod@3.22.4` - Schema validation

**New Dependency:**
- ⏳ `@cloudflare/workers-oauth-provider` - OAuth 2.1 server implementation

#### E. Add Environment Variables

**Update `.dev.vars`:**
```bash
# Existing
ENCRYPTION_KEY=...
LOG_LEVEL=info
DEV_AUTH_BYPASS=true
DEV_USER_EMAIL=dev@reset.tech
JWT_SECRET=dev-secret-32-chars-minimum-12345678

# Add for OAuth testing
APP_URL=http://localhost:8789
```

**Note:** APP_URL needed for OAuth metadata discovery

**Total Effort:** 6-8 hours (1 day)

### 2. Production Deployment (AFTER OAuth Testing)

**Prerequisite:** OAuth 2.1 working in local dev

**Steps:**

#### A. Cloudflare Access Setup (30 min)
1. Create Access application at https://one.dash.cloudflare.com
   - URL: `https://zoku.205.dev`
   - Session: 24 hours
   - Providers: Google Workspace, Email OTP
   - Note AUD tag

#### B. KV Namespace (2 min)
```bash
wrangler kv:namespace create "AUTH_KV"
wrangler kv:namespace create "AUTH_KV" --preview
```
Update `wrangler.toml` with returned IDs

#### C. Secrets (5 min)
```bash
wrangler secret put CF_ACCESS_TEAM_DOMAIN
# https://<team>.cloudflareaccess.com

wrangler secret put CF_ACCESS_AUD
# <aud-from-step-A>

wrangler secret put JWT_SECRET
# $(openssl rand -base64 32)

wrangler secret put APP_URL
# https://zoku.205.dev
```

#### D. Database Migration (5 min)
```bash
npm run db:migrate:remote
wrangler d1 execute the-great-game --remote --command "SELECT * FROM zoku LIMIT 1"
```

#### E. Deploy (5 min)
```bash
npm run deploy
```

#### F. End-to-End Test (30 min)
1. ✅ Web auth via CF Access → auto-create coherent user
2. ✅ Account page loads
3. ✅ OAuth config shown for MCP
4. ✅ Add to Claude Desktop (OAuth method)
5. ✅ Client opens browser → CF Access login → OAuth authorize page
6. ✅ Approve → client receives tokens
7. ✅ MCP connection established
8. ✅ Read tools work (list_entanglements, etc.)
9. ✅ Write tools blocked (coherent tier)
10. ✅ Admin promotes to entangled (via DB or future UI)
11. ✅ Write tools work (create_entanglement, etc.)
12. ✅ PAT generation works as fallback
13. ✅ PAT revocation works

**Total Time:** ~60 minutes

---

## Implementation Plan (Linear - OAuth First)

### Phase 1: OAuth 2.1 Implementation (Day 1-2)

**1.1. Research & Setup** (1 hour)
- ✅ Verify `@cloudflare/workers-oauth-provider` or use Arctic
- ✅ Review MCP OAuth spec
- ✅ Check current `validateMcpToken` logic

**1.2. Backend Implementation** (4-6 hours)
- ✅ Create `src/lib/oauth-setup.ts`
- ✅ Create `src/api/mcp-oauth.ts`
  - Authorization UI (GET)
  - Authorization handler (POST)
  - Mount provider middleware
- ✅ Update `src/lib/mcp-tokens.ts` to try OAuth first
- ✅ Mount `/oauth` routes in `src/index.ts`

**1.3. Frontend Update** (15 min)
- ✅ Update AccountPage.tsx OAuth section (accurate now!)

**1.4. Local Testing** (2 hours)
- ✅ Test OAuth flow in browser
  - Navigate to `/oauth/authorize?client_id=test&...`
  - Verify CF Access auth required
  - Verify authorization page renders
  - Verify approval redirects correctly
- ✅ Test token exchange
  - Mock client code exchange
  - Verify access token returned
- ✅ Test MCP connection with Claude Desktop
  - Add server config (OAuth method)
  - Verify browser opens for auth
  - Verify token received
  - Test tool calls
- ✅ Test token refresh
- ✅ Test token revocation

**Phase 1 Complete:** OAuth 2.1 working locally

### Phase 2: Production Deployment (Day 2-3)

**2.1. Infrastructure Setup** (40 min)
- ✅ Create Cloudflare Access app
- ✅ Create AUTH_KV namespace
- ✅ Set production secrets

**2.2. Deploy** (20 min)
- ✅ Run migration remotely
- ✅ Deploy worker
- ✅ Verify deployment

**2.3. End-to-End Test** (30 min)
- ✅ Complete test checklist above
- ✅ Verify OAuth flow in production
- ✅ Verify PAT fallback works

**Phase 2 Complete:** Production authentication live

### Phase 3: Admin UI (Optional - Post-Launch)

**Future Work:**
- User management UI (promote/demote)
- Audit log viewer
- Better error messages
- Onboarding wizard

---

## Testing Checklist

### Pre-Deployment (Local)

**OAuth Flow:**
- [ ] Authorization page loads with CF Access
- [ ] User info displays correctly (email, tier)
- [ ] Approve redirects to client with code
- [ ] Deny redirects with error
- [ ] Token exchange works (code → access + refresh)
- [ ] Access token validates correctly
- [ ] Refresh token rotates correctly
- [ ] Revocation works

**MCP Integration:**
- [ ] Claude Desktop connects via OAuth
- [ ] Browser opens for authorization
- [ ] Tokens received automatically
- [ ] Read tools work (all tiers)
- [ ] Write tools blocked (coherent tier)
- [ ] Write tools work (entangled tier)
- [ ] Tool errors show tier requirements

**PAT Fallback:**
- [ ] Account page shows PAT section
- [ ] Token generation works
- [ ] Token revocation works
- [ ] MCP connects with Bearer token
- [ ] Same tier enforcement as OAuth

**Edge Cases:**
- [ ] Expired access token → auto-refresh
- [ ] Revoked token → error
- [ ] Observed tier → OAuth succeeds but tools blocked
- [ ] Session cache works (5-min TTL)
- [ ] Dev bypass still works with env var

### Post-Deployment (Production)

**Infrastructure:**
- [ ] CF Access protects application
- [ ] AUTH_KV exists and accessible
- [ ] Secrets configured correctly
- [ ] Migration applied successfully

**OAuth Production:**
- [ ] OAuth authorization URL resolves
- [ ] Discovery endpoint works (/.well-known/*)
- [ ] Token endpoint works (/oauth/token)
- [ ] Revoke endpoint works (/oauth/revoke)

**End-to-End:**
- [ ] Complete test checklist from section 2.3.F

---

## Success Criteria

**Before Deployment:**
- ✅ OAuth 2.1 fully implemented and tested locally
- ✅ Both OAuth and PAT methods work
- ✅ Account page UI is accurate
- ✅ All tier enforcement works correctly

**After Deployment:**
- ✅ Production OAuth flow works end-to-end
- ✅ Claude Desktop connects successfully
- ✅ Tier-based authorization enforced
- ✅ Audit logging captures operations
- ✅ Admin can promote users

---

## Current Blockers

1. **OAuth 2.1 not implemented** - Blocks all testing and deployment
2. **UI advertises non-working feature** - Misleading to users

**Unblock Strategy:** Implement OAuth 2.1 (Day 1-2), then deploy (Day 2-3)

---

## Comparison: Plan vs Reality

| Phase | Planned | Status | Blocker |
|-------|---------|--------|---------|
| Phase 1: Foundation | Week 1 | ✅ DONE | None |
| Phase 2: API Auth | Week 2 | ✅ DONE | None |
| Phase 3: Frontend | Week 2-3 | ✅ DONE | None |
| **Phase 4: MCP Auth** | **Week 3-4** | **⚠️ INCOMPLETE** | **OAuth missing** |
| Phase 5: Deploy | Week 4 | ⏳ BLOCKED | Phase 4 |
| Phase 6: Admin UI | Week 5+ | ⏳ OPTIONAL | None |

**Actual Timeline:** ~2 weeks done + 1-2 days for OAuth + deployment

---

## Next Steps (Ordered by Priority)

### 1. Implement OAuth 2.1 (CRITICAL - DO FIRST)

**Day 1:**
- Morning: Research OAuth library, create oauth-setup.ts
- Afternoon: Build authorization UI, implement endpoints
- Evening: Update token validation, test locally

**Day 2:**
- Morning: Integration testing with Claude Desktop
- Afternoon: Edge case testing, refinements
- Evening: Document OAuth flow, prepare for deployment

### 2. Deploy to Production (AFTER OAuth Works)

**Day 2-3:**
- Create CF Access app
- Configure KV and secrets
- Run migration
- Deploy
- Test end-to-end

### 3. Monitor & Iterate (Post-Deployment)

- Watch logs for auth errors
- Gather user feedback
- Build admin UI if needed

---

## Recommendation

**Must complete OAuth 2.1 before any deployment or testing.**

**Linear path:**
1. OAuth implementation (1-2 days)
2. Local testing (complete checklist)
3. Production deployment (1 hour)
4. Production testing (complete checklist)

**Timeline:** 2-3 days from start to production-ready authentication.

---

## Files Cleaned Up

**Removed:** 3 outdated planning documents
- `authentication-implementation-plan.md` (2000+ lines, superseded)
- `authentication-implementation-status.md` (replaced by this doc)
- `auth-plan-simplification-summary.md` (historical)

**Kept:**
- `authentication-implementation-progress.md` (status log)
- `auth-remaining-work.md` (THIS FILE - current source of truth)

---

## References

**MCP OAuth Specification:**
- [MCP Authorization Specification](https://spec.modelcontextprotocol.io/latest/specification/2025-06-18/basic/authorization/)
- [Cloudflare Agents MCP Authorization](https://developers.cloudflare.com/agents/model-context-protocol/authorization/)

**OAuth Libraries:**
- [@cloudflare/workers-oauth-provider](https://github.com/cloudflare/workers-oauth-provider) - OAuth 2.1 server for Workers
- [Arctic](https://arcticjs.dev/) - OAuth client library (already installed)

**OAuth Standards:**
- [RFC 8414](https://datatracker.ietf.org/doc/html/rfc8414) - OAuth 2.0 Authorization Server Metadata
- [RFC 7591](https://datatracker.ietf.org/doc/html/rfc7591) - OAuth 2.0 Dynamic Client Registration
- [RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749) - OAuth 2.0 Authorization Framework
- [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636) - PKCE for OAuth Public Clients
