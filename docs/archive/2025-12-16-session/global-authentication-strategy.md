# Global Authentication Strategy
**Date**: 2025-12-16  
**Status**: 🚧 Design Document

## Problem Statement

Currently, some endpoints are unprotected (e.g., `GET /api/zoku`, `GET /api/dimensions`), allowing unauthenticated access. We need to:

1. **Require CF Access JWT for ALL web UI access** (except OAuth flow)
2. **Require Bearer token for ALL MCP access** (OAuth or PAT)
3. **Allow OAuth discovery/registration without authentication** (can't have JWT before OAuth completes)
4. **Show friendly error message** for unauthenticated users

## Authentication Domains

### Domain 1: Web UI (Browser Access)
**Auth Method**: Cloudflare Access JWT in `cf-access-jwt-assertion` header

**Behavior**:
- **Production**: Validate JWT against CF Access JWKS
- **Dev**: Decode JWT without validation (skip JWKS fetch)
- **Both**: Auto-create user as `coherent` on first login

**Protected**: All `/api/*` endpoints, frontend assets

### Domain 2: MCP (Machine Access)
**Auth Method**: Bearer token (OAuth access token OR Personal Access Token)

**Behavior**:
- Try OAuth token first (stored in KV)
- Fall back to PAT (JWT with revocation check)
- Session-aware caching (5-min TTL)

**Protected**: `/mcp` endpoint (except initial unauthenticated discovery)

### Domain 3: OAuth Flow (MCP Onboarding)
**Auth Method**: Mixed (some public, some CF Access)

**Public endpoints** (must work without auth):
- `GET /.well-known/oauth-authorization-server` - Discovery
- `POST /oauth/token` - Token exchange
- `POST /oauth/register` - Dynamic client registration

**CF Access protected** (requires user to be logged in):
- `GET /oauth/authorize` - Authorization UI
- `POST /oauth/authorize` - User approval

**Rationale**: MCP client doesn't have JWT before OAuth completes. Discovery and token exchange must be public. But authorization requires user interaction in browser, so CF Access protects it.

---

## Implementation Strategy

### Option A: Global Middleware with Exceptions (Recommended)

**Approach**: Apply auth middleware globally, explicitly exclude OAuth public routes.

```typescript
// src/index.ts
const app = new Hono<{ Bindings: Bindings }>();

// CORS + Logging (global, no exceptions)
app.use('/*', cors());
app.use('/*', loggingMiddleware());

// Health check (public, for monitoring)
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'zoku' });
});

// OAuth public routes (no auth required)
app.get('/.well-known/oauth-authorization-server', oauthDiscoveryHandler);
app.post('/oauth/token', oauthTokenHandler);
app.post('/oauth/register', oauthRegisterHandler);
app.post('/oauth/revoke', oauthRevokeHandler);

// OAuth protected routes (CF Access required)
app.get('/oauth/authorize', authMiddleware(), oauthAuthorizeGetHandler);
app.post('/oauth/authorize', authMiddleware(), oauthAuthorizePostHandler);

// OAuth session management (CF Access required)
app.get('/oauth/sessions', authMiddleware(), listSessionsHandler);
app.delete('/oauth/sessions/:id', authMiddleware(), revokeSessionHandler);

// Global authentication for everything else
app.use('/api/*', authMiddleware());
app.use('/mcp', mcpAuthMiddleware());  // Different auth (Bearer token)

// API routes (all protected by above middleware)
app.route('/api/entanglements', entanglementsRoutes);
app.route('/api/zoku', zokuRoutes);
// ... etc
```

**Pros**:
- Clear separation: public routes defined first, then global protection
- Easy to audit (all protected by default unless explicitly public)
- Matches security principle: deny by default, allow by exception

**Cons**:
- Need to carefully order routes (public before middleware)
- Could accidentally expose endpoint if defined before middleware

---

### Option B: Per-Route Middleware (Current Approach)

**Approach**: Explicitly add `authMiddleware()` to each route group.

```typescript
// src/api/entanglements.ts
const app = new Hono<{ Bindings: Bindings }>();

app.get('/', authMiddleware(), async (c) => { /* ... */ });
app.post('/', authMiddleware(), requireTier('entangled'), async (c) => { /* ... */ });
// ... all routes protected individually
```

**Pros**:
- Explicit (can see protection at each route)
- Flexible (easy to make exceptions)

**Cons**:
- Easy to forget `authMiddleware()` on new routes
- Inconsistent (some routes have it, some don't)
- Hard to audit (need to check every single route)

---

## Recommended Approach: Option A (Global with Exceptions)

### Implementation Plan

1. **Define Public Routes First**
   - `/health` - Health check
   - `/.well-known/oauth-authorization-server` - OAuth discovery
   - `/oauth/token` - Token exchange
   - `/oauth/register` - Client registration
   - `/oauth/revoke` - Token revocation

2. **Apply Global Middleware**
   - `/api/*` → `authMiddleware()` (CF Access JWT)
   - `/mcp` → `mcpAuthMiddleware()` (Bearer token)

3. **Update Auth Middleware for Friendly Errors**
   ```typescript
   export function authMiddleware() {
     return async (c: Context, next: Next) => {
       const token = extractCloudflareAccessToken(c.req.raw);
       
       if (!token) {
         return c.json({ 
           error: 'Authentication required',
           message: 'Please log in via Cloudflare Access to continue.',
           login_url: c.env.CF_ACCESS_TEAM_DOMAIN 
         }, 401);
       }
       
       // ... rest of validation
     };
   }
   ```

4. **Update Individual Route Files**
   - Remove redundant `authMiddleware()` from individual routes
   - Keep tier checks (`requireTier()`)
   - Focus on authorization, not authentication

---

## MCP OAuth Flow (with Auth Requirements)

```
1. MCP Client → GET /.well-known/oauth-authorization-server
   [Public - no auth required]
   Returns: OAuth endpoints

2. MCP Client → POST /oauth/register
   [Public - no auth required]
   Returns: client_id, client_secret

3. MCP Client → Opens browser to /oauth/authorize?client_id=...
   [CF Access protected - user must log in]
   User sees: Authorization page

4. User clicks "Authorize"
   [CF Access protected]
   POST /oauth/authorize
   Returns: Authorization code

5. MCP Client → POST /oauth/token (code → access token)
   [Public - no auth required]
   Returns: access_token, refresh_token

6. MCP Client → POST /mcp (with Bearer token)
   [Bearer auth required]
   Returns: MCP responses
```

**Key Insight**: Steps 1, 2, 5 must be public (client doesn't have auth yet). Steps 3, 4 require CF Access (user interaction in browser). Step 6 requires Bearer token (MCP access).

---

## Error Messages

### Unauthenticated Web UI Access
```json
{
  "error": "Authentication required",
  "message": "Please log in via Cloudflare Access to continue.",
  "code": "UNAUTHENTICATED"
}
```

### Unauthenticated MCP Access
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32001,
    "message": "Authentication required. Please use OAuth or generate a Personal Access Token."
  },
  "id": null
}
```

### Unauthorized (Insufficient Tier)
```json
{
  "error": "Insufficient permissions",
  "message": "This action requires prime access or higher. You have coherent access.",
  "code": "FORBIDDEN"
}
```

---

## Edge Cases

### 1. Frontend Assets
**Question**: Should frontend HTML/JS/CSS require CF Access?

**Answer**: **Yes**. Frontend should be protected by CF Access. Assets served via Cloudflare Workers don't bypass middleware.

**Implementation**: Frontend assets served by worker, CF Access protects entire domain.

---

### 2. Health Check
**Question**: Should `/health` require auth?

**Answer**: **No**. Health checks used by monitoring systems (uptime monitors, load balancers) that don't have JWT.

**Implementation**: Define `/health` before global middleware.

---

### 3. OAuth Token Revocation
**Question**: Should `/oauth/revoke` require auth?

**Answer**: **No** (per RFC 7009). Clients can revoke their own tokens without authentication (token itself proves identity).

**Implementation**: Define `/oauth/revoke` before global middleware. Token validation done inside handler.

---

### 4. MCP Discovery (Initial Connection)
**Question**: Does MCP client need auth before discovering OAuth?

**Answer**: **No**. MCP spec allows unauthenticated discovery. Client GETs `/.well-known/oauth-authorization-server` to find out auth is required.

**Implementation**: Discovery endpoint public, returns OAuth endpoints.

---

## Security Considerations

### Defense in Depth
Even with global middleware, maintain tier checks:
- `requireTier('coherent')` - Jewel management
- `requireTier('entangled')` - CRUD operations
- `requireTier('prime')` - Admin operations

### Audit Logging
Log authentication failures:
```typescript
logger.warn('Authentication failed', {
  path: c.req.path,
  ip: c.req.header('cf-connecting-ip'),
  user_agent: c.req.header('user-agent')
});
```

### Rate Limiting
Consider rate limiting unauthenticated requests to OAuth endpoints to prevent abuse.

---

## Testing Strategy

### Unit Tests
- Auth middleware returns 401 without token
- Auth middleware validates token in production
- Auth middleware decodes token in dev
- OAuth discovery works without auth
- OAuth token exchange works without auth

### Integration Tests
- Unauthenticated API request → 401
- Authenticated API request → 200/403 (depending on tier)
- MCP without Bearer token → 401
- MCP with valid Bearer token → 200
- OAuth flow completes successfully

### E2E Tests
- User can't access UI without CF Access
- User can complete OAuth flow
- MCP client can connect with OAuth
- MCP client can connect with PAT

---

## Migration Plan

### Phase 1: Add Global Middleware (Non-Breaking)
1. Apply `app.use('/api/*', authMiddleware())` in `index.ts`
2. Keep existing `authMiddleware()` calls in route files (redundant but safe)
3. Deploy and test

### Phase 2: Remove Redundant Middleware (Cleanup)
1. Remove `authMiddleware()` from individual route files
2. Keep tier checks (`requireTier()`)
3. Deploy and test

### Phase 3: Add Friendly Error Messages
1. Update auth middleware with better error messages
2. Update frontend to show login prompt on 401
3. Deploy and test

---

## Recommended Changes

### File: `src/index.ts`
```typescript
// Public routes (no auth)
app.get('/health', healthHandler);
app.get('/.well-known/oauth-authorization-server', oauthDiscoveryHandler);
app.post('/oauth/token', oauthTokenHandler);
app.post('/oauth/register', oauthRegisterHandler);
app.post('/oauth/revoke', oauthRevokeHandler);

// OAuth protected routes (CF Access)
app.get('/oauth/authorize', authMiddleware(), oauthAuthorizeGetHandler);
app.post('/oauth/authorize', authMiddleware(), oauthAuthorizePostHandler);
app.get('/oauth/sessions', authMiddleware(), listSessionsHandler);
app.delete('/oauth/sessions/:id', authMiddleware(), revokeSessionHandler);

// Global protection
app.use('/api/*', authMiddleware());  // All API routes require CF Access
app.all('/mcp', mcpHandler);  // MCP has its own auth inside handler

// API routes (protected by above middleware)
app.route('/api/entanglements', entanglementsRoutes);
app.route('/api/zoku', zokuRoutes);
// ... etc
```

### File: `src/middleware/auth.ts`
```typescript
export function authMiddleware() {
  return async (c: Context, next: Next) => {
    const token = extractCloudflareAccessToken(c.req.raw);
    
    if (!token) {
      logger.warn('Missing CF Access JWT', { path: c.req.path });
      return c.json({ 
        error: 'Authentication required',
        message: 'Please log in to continue.',
        code: 'UNAUTHENTICATED'
      }, 401);
    }
    
    // Dev mode: decode without validation
    // Production: validate against JWKS
    // ... rest of existing logic
  };
}
```

---

## Conclusion

**Recommended approach**: Apply global `authMiddleware()` to `/api/*` after defining OAuth public routes. This ensures:

1. ✅ All web UI access requires CF Access JWT
2. ✅ All API access requires authentication
3. ✅ OAuth discovery/token exchange remain public (required for OAuth flow)
4. ✅ OAuth authorization requires CF Access (user interaction)
5. ✅ MCP access requires Bearer token (separate flow)
6. ✅ Friendly error messages for unauthenticated users

This provides defense-in-depth while maintaining OAuth compatibility.
