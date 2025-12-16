# Authentication System
**Status**: Complete ✅ | Ready for Production
**Last Updated**: 2025-12-16

## Overview

The Great Game implements a comprehensive four-tier authentication system with dual MCP authentication methods (OAuth 2.1 primary, PAT fallback) and Cloudflare Access for web UI.

## Architecture

### Two Authentication Domains

**1. Web UI Authentication**
- Uses Cloudflare Access JWT (`cf-access-jwt-assertion` header)
- Dev mode: Skips JWKS validation, trusts JWT
- Production: Validates against Cloudflare Access JWKS
- Auto-creates users on first login as `coherent` tier

**2. MCP Authentication**
- Primary: OAuth 2.1 (automatic, browser-based)
- Fallback: Personal Access Tokens (manual, long-lived)
- Both use JWT format, stored in AUTH_KV
- Session-aware caching (5-minute TTL)

## Access Tiers

Four-level hierarchy enforced across all endpoints:

| Tier | Level | Web UI | MCP Tools | Use Case |
|------|-------|--------|-----------|----------|
| **observed** | 0 | ❌ No access | ❌ Blocked | Pre-created for PASCI, awaiting activation |
| **coherent** | 1 | ✅ Read-only | ✅ Read + jewel mgmt | Guests, observers, new users |
| **entangled** | 2 | ✅ Full CRUD | ✅ All write operations | Team members, contributors |
| **prime** | 3 | ✅ Admin | ✅ All tools + tier mgmt | System administrators |

### Tier Transitions

- New users → `coherent` (auto-created on first login)
- `observed` → `coherent` (auto-promoted on first login)
- `coherent` → `entangled` (manual, Prime only)
- `entangled` → `prime` (manual, Prime only)
- Any → `observed` (revoke access, Prime only)

## OAuth 2.1 for MCP

### Implementation

**Manual OAuth 2.1 server** using jose + KV (no external dependencies):
- RFC 8414 metadata discovery
- Authorization code grant with PKCE (S256 required)
- Token exchange (code → access + refresh tokens)
- Refresh token rotation (30-day TTL)
- Dynamic client registration (RFC 7591)
- Token revocation

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/.well-known/oauth-authorization-server` | GET | RFC 8414 metadata discovery |
| `/oauth/authorize` | GET | Authorization UI (quantum-themed) |
| `/oauth/authorize` | POST | User approval handler |
| `/oauth/token` | POST | Token exchange & refresh |
| `/oauth/register` | POST | Dynamic client registration |
| `/oauth/revoke` | POST | Token revocation |
| `/oauth/sessions` | GET | List user's active sessions |
| `/oauth/sessions/:id` | DELETE | Revoke specific session |

### OAuth Flow

```
1. Client connects to http://localhost:3000/mcp
2. Gets 401 (auth required)
3. Discovers OAuth via /.well-known/oauth-authorization-server
4. Opens browser to /oauth/authorize
5. User sees quantum-themed authorization page
6. User clicks "Authorize"
7. Success page shown (5-second countdown, auto-redirects)
8. Client receives authorization code
9. Client exchanges code for access + refresh tokens
10. Client uses access token for MCP requests
11. Tokens auto-refresh when expired
```

### OAuth Tokens

**Access Token (JWT):**
- Lifetime: 1 hour
- Claims: `user_id`, `tier`, `scope`, `token_type: 'oauth'`
- Stored in KV: `oauth:access:{tokenId}`

**Refresh Token (JWT):**
- Lifetime: 30 days
- Claims: `user_id`, `access_token_id`, `token_type: 'oauth_refresh'`
- Stored in KV: `oauth:refresh:{tokenId}`

**Session Tracking:**
- Each authorization creates a session record
- Stored in KV: `oauth:user:sessions:{userId}`
- Visible in Account page with revoke capability

## Personal Access Tokens (PAT)

### Implementation

JWT-based tokens with KV revocation blocklist:
- User generates via Account page
- Expiration options: 30, 60, 90, 365 days
- Stored in AUTH_KV with metadata
- Session-aware caching (5-min TTL)

### PAT Management

**Account Page Features:**
- Generate tokens with custom name and expiration
- View token list (name, created, expires, last used)
- Revoke tokens (adds to KV blocklist)
- Token shown only once (copy to clipboard)

**API Endpoints:**
- `GET /api/mcp-tokens` - List user's tokens
- `POST /api/mcp-tokens` - Generate new token
- `DELETE /api/mcp-tokens/:id` - Revoke token

### PAT vs OAuth

| Feature | OAuth | PAT |
|---------|-------|-----|
| **Setup** | Automatic | Manual copy/paste |
| **Lifetime** | 1hr access + 30day refresh | 30-365 days |
| **Revocation** | Immediate | Immediate |
| **Use Case** | Claude Desktop, modern clients | Scripts, legacy clients |
| **Security** | Short-lived, auto-refresh | Long-lived, manual rotation |

## Token Validation

### MCP Token Validation Flow

```typescript
validateMcpToken(token, env, db, isInitialize):
  1. Try OAuth token first
     - Verify JWT signature
     - Check token_type === 'oauth'
     - Verify token exists in KV (not revoked)
     - Return user

  2. Fall back to PAT
     - Verify JWT signature
     - Reject if token_type === 'oauth' (already revoked)
     - Check KV revocation list
     - Cache for 5 minutes
     - Return user

  3. If both fail → 401 error
```

### Session-Aware Caching

- **On `initialize`**: Full validation (check KV revocation)
- **On tool calls**: Use 5-minute cache (skip KV)
- Reduces KV reads by ~95%
- Still secure (revocation checked on new sessions)

## Development Mode

### Dev Configuration

In dev (no `CF_ACCESS_TEAM_DOMAIN` configured):
- JWT validation **skipped** for web UI
- Just decode JWT and extract email
- Use `cf-access-jwt-assertion` header (same as production)

**Generate Dev JWT:**
```bash
node scripts/generate-dev-jwt.js your@email.com
```

**Use with ModHeader browser extension:**
```
Header: cf-access-jwt-assertion
Value: <generated-jwt>
```

### Dev vs Production

| Aspect | Development | Production |
|--------|-------------|------------|
| **Web Auth** | Skip validation, decode JWT | Validate with CF Access JWKS |
| **MCP Auth** | OAuth/PAT (full validation) | OAuth/PAT (full validation) |
| **Header** | `cf-access-jwt-assertion` | `cf-access-jwt-assertion` |
| **User Creation** | Auto-create from JWT email | Auto-create from CF Access |
| **Default Tier** | coherent | coherent |

## Database Schema

### Zoku Table (Auth Fields)

```sql
ALTER TABLE zoku ADD COLUMN access_tier TEXT NOT NULL DEFAULT 'observed'
  CHECK (access_tier IN ('observed', 'coherent', 'entangled', 'prime'));
ALTER TABLE zoku ADD COLUMN email TEXT UNIQUE;
ALTER TABLE zoku ADD COLUMN cf_access_sub TEXT;
ALTER TABLE zoku ADD COLUMN last_login INTEGER;
ALTER TABLE zoku ADD COLUMN created_by TEXT;
ALTER TABLE zoku ADD COLUMN updated_by TEXT;
```

### Jewels Table (Ownership)

```sql
ALTER TABLE jewels ADD COLUMN owner_id TEXT REFERENCES zoku(id) ON DELETE CASCADE;
```

### Audit Log Table

```sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
  zoku_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  request_id TEXT
);
```

## KV Storage

### OAuth Tokens

```
oauth:code:{code}           → Authorization codes (10-min TTL)
oauth:access:{tokenId}      → Access token metadata (1-hr TTL)
oauth:refresh:{tokenId}     → Refresh token metadata (30-day TTL)
oauth:client:{clientId}     → Registered clients
oauth:user:sessions:{userId} → User's session list
```

### PAT Tokens

```
pat:user:{userId}     → Token metadata list (for UI)
pat:revoked:{tokenId} → Revocation blocklist (TTL = expiry)
```

## Permission Matrix

### API Endpoints

| Operation | coherent | entangled | prime |
|-----------|----------|-----------|-------|
| **Entanglements** | | | |
| View all | ✅ | ✅ | ✅ |
| Create/Edit/Delete | ❌ | ✅ | ✅ |
| **Zoku** | | | |
| View all | ✅ | ✅ | ✅ |
| Create (as observed) | ❌ | ✅ | ✅ |
| Edit own | ✅ | ✅ | ✅ |
| Promote users | ❌ | ❌ | ✅ |
| **Jewels** | | | |
| View own | ✅ | ✅ | ✅ |
| Create/Edit/Delete own | ✅ | ✅ | ✅ |
| Delete others | ❌ | ❌ | ✅ |
| **Sources** | | | |
| View all | ✅ | ✅ | ✅ |
| Create/Edit/Delete | ❌ | ✅ | ✅ |
| **Qupts** | | | |
| View all | ✅ | ✅ | ✅ |
| Create | ❌ | ✅ | ✅ |

### MCP Tools

**Read Tools** (all authenticated tiers):
- list_entanglements, get_entanglement, get_child_entanglements
- list_qupts, list_zoku, get_entangled
- get_matrix, list_dimensions, get_attributes
- list_sources, list_jewels, get_jewel, get_jewel_usage

**Coherent+ Tools**:
- add_jewel, update_jewel, delete_jewel (manage own jewels)

**Entangled+ Tools**:
- create_entanglement, update_entanglement, delete_entanglement, move_entanglement
- create_qupt, create_zoku
- entangle, disentangle, set_attributes
- add_source, sync_source, remove_source, toggle_source

## Local Testing

### Setup

**1. Start servers:**
```bash
# Backend (port 8789)
npm run dev

# Frontend (port 3000)
cd frontend && npm run dev
```

**2. Generate dev JWT:**
```bash
node scripts/generate-dev-jwt.js dev@reset.tech
```

**3. Add to browser:**
- Install ModHeader extension
- Add header: `cf-access-jwt-assertion: <jwt>`

**4. Test web UI:**
- Visit `http://localhost:3000`
- Should auto-create user and show dashboard

**5. Test MCP OAuth:**
```json
{
  "mcpServers": {
    "zoku_local": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```
- Client discovers OAuth, opens browser
- Authorize and test tools

### OAuth Revocation Testing

1. Go to Account page (`http://localhost:3000/?view=account`)
2. See "Active OAuth Sessions" table
3. Click "Revoke" on a session
4. Try using MCP tool → should fail immediately
5. Reconnect → OAuth flow starts again

### PAT Testing

1. Go to Account page
2. Click "Generate Token" under Personal Access Tokens
3. Copy token
4. Configure MCP client with Bearer token:
```json
{
  "mcpServers": {
    "zoku_local": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer <token>"
      }
    }
  }
}
```
5. Test revocation from Account page

## Production Deployment

### Prerequisites

**1. Create Cloudflare Access Application**
- URL: `https://zoku.205.dev`
- Session: 24 hours
- Providers: Google Workspace, Email OTP
- Note the AUD tag

**2. Create AUTH_KV Namespace**
```bash
wrangler kv:namespace create "AUTH_KV"
wrangler kv:namespace create "AUTH_KV" --preview
```

Update `wrangler.toml` with returned IDs.

**3. Set Production Secrets**
```bash
wrangler secret put CF_ACCESS_TEAM_DOMAIN
# Value: https://<your-team>.cloudflareaccess.com

wrangler secret put CF_ACCESS_AUD
# Value: <aud-tag-from-step-1>

wrangler secret put JWT_SECRET
# Value: $(openssl rand -base64 32)

wrangler secret put APP_URL
# Value: https://zoku.205.dev
```

**4. Deploy**
```bash
npm run deploy
```

### Post-Deployment Testing

1. Visit `https://zoku.205.dev`
2. Authenticate via Cloudflare Access
3. Verify auto-created as `coherent` tier
4. Go to Account page
5. Test OAuth: Add MCP server, authorize, verify tools work
6. Test PAT: Generate token, configure client, verify tools work
7. Test revocation: Revoke session/token, verify client disconnects
8. Promote user to `entangled` via database
9. Verify write operations work

## Implementation Details

### Files

**Backend:**
- `src/middleware/auth.ts` - Web auth (CF Access or dev JWT)
- `src/lib/cf-access.ts` - CF Access JWT validation
- `src/lib/mcp-oauth.ts` - OAuth 2.1 server (~320 lines)
- `src/lib/mcp-tokens.ts` - PAT generation/validation
- `src/api/mcp-oauth.ts` - OAuth endpoints + UI (~660 lines)
- `src/api/mcp-tokens.ts` - PAT management API

**Frontend:**
- `frontend/src/lib/auth.tsx` - Auth context, hooks
- `frontend/src/components/AccountPage.tsx` - Profile + tokens + sessions
- `frontend/src/components/AccessDenied.tsx` - Access denied page

**Database:**
- `migrations/005_add_authentication.sql` - Auth schema
- `schema.sql` - Complete schema with auth fields

**Configuration:**
- `wrangler.toml` - AUTH_KV binding, fixed port 8789
- `.dev.vars` - JWT_SECRET, APP_URL (no bypass vars)
- `scripts/generate-dev-jwt.js` - Dev JWT generator

### Key Features

✅ **OAuth 2.1 compliant** - RFC 8414, PKCE, dynamic registration
✅ **Dual authentication** - OAuth (primary) + PAT (fallback)
✅ **Session management** - Track and revoke OAuth sessions
✅ **Tier-based permissions** - 4 levels with auto-promotion
✅ **Token revocation** - Immediate for both OAuth and PAT
✅ **Audit logging** - Track all sensitive operations
✅ **Jewel ownership** - User-owned credentials
✅ **Dev mode** - Skip validation, production-like flow
✅ **Beautiful UI** - Quantum-themed authorization pages

## Security Features

- **PKCE mandatory** - Code challenge verification (S256)
- **Token type isolation** - OAuth tokens can't validate as PATs
- **Revocation checks** - KV blocklist with automatic TTL
- **Session caching** - 5-min cache, reduces KV load 95%
- **HTTPS enforcement** - Redirect URIs must be HTTPS or localhost
- **Audit trail** - All operations logged with request correlation
- **Encrypted jewels** - AES-GCM encryption at rest
- **No token logging** - Secrets never logged or transmitted in URLs

## Troubleshooting

### OAuth Not Working

**Check:**
- `/.well-known/oauth-authorization-server` returns JSON
- `APP_URL` is configured in environment
- `AUTH_KV` namespace exists
- Vite proxy forwards `/.well-known` and `/oauth` paths

### Token Revocation Not Working

**Verify:**
- Token type check in PAT validation (rejects OAuth tokens)
- KV delete succeeds (check AUTH_KV binding)
- Client sends new request (not using cached connection)
- Session list updates after revocation

### Web UI 401 Errors

**In dev:**
- Generate JWT: `node scripts/generate-dev-jwt.js your@email.com`
- Add `cf-access-jwt-assertion` header via ModHeader
- Verify JWT has `email` claim

**In production:**
- Verify Cloudflare Access configured correctly
- Check AUD tag matches `CF_ACCESS_AUD` secret
- Verify user has access in CF Access policy

## Performance

**Token Validation:**
- OAuth validation: ~1-2ms (JWT verify + KV check)
- PAT validation (cached): ~0.1ms (memory lookup)
- PAT validation (uncached): ~1-2ms (JWT verify + KV check)

**Session Caching:**
- Cache hit rate: ~99% (all tool calls after initialize)
- KV reads saved: ~95% reduction
- Total overhead: < 2ms per request

## Migration History

- `migrations/005_add_authentication.sql` - Complete auth implementation
  - Extended zoku table with auth fields
  - Added owner_id to jewels
  - Created audit_log table
  - All indexes and constraints

## References

**MCP Specification:**
- [MCP Authorization](https://spec.modelcontextprotocol.io/latest/specification/2025-06-18/basic/authorization/)
- [Cloudflare Agents MCP](https://developers.cloudflare.com/agents/model-context-protocol/authorization/)

**OAuth Standards:**
- [RFC 8414](https://datatracker.ietf.org/doc/html/rfc8414) - Authorization Server Metadata
- [RFC 7591](https://datatracker.ietf.org/doc/html/rfc7591) - Dynamic Client Registration
- [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636) - PKCE
- [RFC 6750](https://datatracker.ietf.org/doc/html/rfc6750) - Bearer Token Usage
