# Authentication Implementation Plan
## The Great Game - Multi-Tier Access Control System

**Document Version**: 1.1
**Created**: 2025-12-12
**Last Updated**: 2025-12-12
**Status**: Ready for Implementation (see [Status Document](./authentication-implementation-status.md))

> **📋 Implementation Status**: No authentication has been implemented yet. This plan is current and ready to execute. See `authentication-implementation-status.md` for detailed current state analysis and required updates to this plan before starting implementation.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Architecture Overview](#architecture-overview)
4. [User Access Tiers](#user-access-tiers)
5. [Database Schema Changes](#database-schema-changes)
6. [Cloudflare Access Integration](#cloudflare-access-integration)
7. [Authentication Middleware](#authentication-middleware)
8. [Jewel Ownership & Permissions](#jewel-ownership--permissions)
9. [Frontend Authentication](#frontend-authentication)
10. [MCP Authentication](#mcp-authentication)
11. [Development Environment](#development-environment)
12. [Migration Strategy](#migration-strategy)
13. [Implementation Phases](#implementation-phases)
14. [Security Considerations](#security-considerations)
15. [Testing Strategy](#testing-strategy)

---

## Executive Summary

This plan outlines the implementation of a comprehensive authentication and authorization system for The Great Game, introducing a four-tier access model (Observed, Coherent, Entangled, Prime) with Cloudflare Access as the identity provider for web access and dual authentication methods (OAuth 2.1 primary + PAT fallback) for MCP access.

### Key Changes

- **User Identity**: Cloudflare Access JWT validation for web, OAuth 2.1 + PAT for MCP
- **Access Tiers**: Four-level permission system with auto-promotion (Observed → Coherent on first login)
- **Jewel Ownership**: User-owned credentials from day one
- **MCP Authentication**: OAuth 2.1 as primary method (automatic), PAT as fallback (manual, 30-365 day expiration)
- **Zero Trust**: All endpoints authenticated, PASCI roles enforced
- **Developer Experience**: JWT-based dev flow tests real auth code path
- **Admin Features**: Audit logging, user tier management UI

### Impact Assessment

- **Breaking Changes**: Yes - all API endpoints require authentication, fresh start
- **Data Migration**: **NONE** - Prototype with no production data, fresh database migration
- **Existing Data**: Will be wiped during migration (no preservation needed)
- **Client Updates**: MCP clients auto-discover OAuth, no manual config for modern clients
- **Timeline**: 3-4 weeks to full production deployment
- **Backward Compatibility**: **None** - Clean slate, no legacy code or data

### ⚠️ Plan Updates Required

Before starting implementation, apply these corrections:

1. **Migration Number**: Use `005_add_authentication.sql` (004 is used for source error tracking)
2. **Remove D1 Token Table**: Do NOT create `mcp_tokens` table in migration - use KV only for both OAuth and PAT
3. **OAuth Library**: Verify `@cloudflare/workers-oauth-provider` package name (recent work used Arctic library)
4. **Dependencies**: Check current `package.json` - some OAuth libs may already be installed

See `authentication-implementation-status.md` for detailed analysis of current state vs this plan.

---

## Current State Analysis

### What Exists Today

Based on comprehensive codebase analysis:

✅ **Infrastructure Ready**:
- Logging middleware with session tracking (`X-Zoku-Session-ID`)
- AES-GCM encryption for sensitive data (`ENCRYPTION_KEY`)
- PASCI matrix database schema (roles exist but not enforced)
- Zoku table (used for team members, extensible for auth users)
- Validation patterns for external services
- Structured logging with request correlation

❌ **Authentication Gaps**:
- **Zero authentication** on all endpoints (API, MCP, webhooks)
- No user identity verification
- No permission checks anywhere in codebase
- No session management or token validation
- Jewels are system-wide, not user-owned
- No audit trail of who performed actions

### Files Requiring Changes

| Category | Files | Changes Required |
|----------|-------|------------------|
| **Middleware** | `src/middleware/` | New `auth.ts` middleware |
| **Database** | `schema.sql`, `src/db.ts` | Add auth fields, update methods |
| **API Routes** | `src/api/*.ts` (all 7 files) | Add permission checks |
| **MCP Server** | `src/mcp/server.ts` | Add OAuth endpoints, validate tokens |
| **Frontend** | `frontend/src/lib/api.ts` | Add token management |
| **Environment** | `wrangler.toml`, `.dev.vars` | Add auth config |

---

## Architecture Overview

### Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRODUCTION FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User → CF Access → JWT Validation → User Middleware → API      │
│           (email)      (signature)     (tier lookup)    (RBAC)   │
│                                                                  │
│  Desktop Client → MCP OAuth/PAT → Token Validation → Tools      │
│                    (bearer token)   (JWT verify)      (RBAC)    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       DEVELOPMENT FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Dev → Localhost → Dev Auth Bypass → Mock User → API            │
│         (port)      (env flag)        (test user)   (full access)│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Security Level |
|-----------|---------------|----------------|
| **Cloudflare Access** | Identity provider for web UI | External (Cloudflare) |
| **JWT Validator** | Verify CF Access tokens | High - signature check |
| **Auth Middleware** | Extract/verify user, check tier | Critical - all requests |
| **Permission Layer** | RBAC based on tier + PASCI | High - authorization |
| **Token Service** | Issue/validate MCP tokens | High - secret-based |
| **OAuth Server** | MCP OAuth 2.1 flow | High - RFC compliant |

---

## User Access Tiers

### Four-Tier System

Aligned with "The Great Game" quantum entanglement theming:

#### 1. **Observed** (Known, No Access)
- **Description**: Exists in the system but has never authenticated or has no access granted
- **Database**: Record exists in `zoku` table, `access_tier = 'observed'`
- **Frontend Access**: ❌ None - 403 Forbidden after CF Access
- **MCP Access**: ❌ None - token generation disabled
- **Use Case**: Team members added to PASCI matrix before they join, historical users

#### 2. **Coherent** (Guest, Read-Only)
- **Description**: Default tier for new authenticated users
- **Frontend Access**: ✅ Read-only on all views
  - View all entanglements, zoku, activity, sources
  - Cannot create, edit, or delete anything
  - Can view their own jewels but not others'
- **MCP Access**: ✅ Read-only tools
  - `list_*`, `get_*` tools work
  - `create_*`, `update_*`, `delete_*` return 403
- **Use Case**: External collaborators, stakeholders, observers

#### 3. **Entangled** (Manager, Read-Write)
- **Description**: Full operational access
- **Frontend Access**: ✅ Full CRUD on all resources
  - Create/edit/delete entanglements, sources, qupts
  - **Create new Zoku (as `observed` tier only)** for PASCI matrix assignment
  - Assign any Zoku to PASCI responsibility matrices
  - Manage their own jewels
  - View others' jewels (encrypted data hidden)
  - Cannot promote users to higher tiers or delete others' jewels
- **MCP Access**: ✅ All tools except user tier management
- **Use Case**: Team members, project managers, active contributors
- **Common Workflow**: Manager creates Zoku for team member → assigns to entanglement PASCI matrix → team member later logs in and is auto-promoted to Coherent

#### 4. **Prime** (Admin, Full Control)
- **Description**: System administrators
- **Frontend Access**: ✅ All Entangled permissions plus:
  - Promote/demote user access tiers
  - Delete any user's jewels
  - View system audit logs
  - Manage global settings (future)
- **MCP Access**: ✅ All tools including user management
- **Use Case**: System owners, technical administrators

### Tier Transition Matrix

| From → To | Allowed By | Method | Notes |
|-----------|-----------|--------|-------|
| (new) → Coherent | System | Auto on first auth | Default for new users |
| Observed → Coherent | Prime | Manual promotion | Activate dormant user |
| Coherent → Entangled | Prime | Manual promotion | Grant write access |
| Entangled → Prime | Prime | Manual promotion | Rare - admin access |
| Any → Observed | Prime | Manual demotion | Revoke access |

### Permission Matrix

| Action | Observed | Coherent | Entangled | Prime |
|--------|----------|----------|-----------|-------|
| **Entanglements** |
| View all | ❌ | ✅ | ✅ | ✅ |
| Create/Edit/Delete | ❌ | ❌ | ✅ | ✅ |
| **Zoku** |
| View all | ❌ | ✅ | ✅ | ✅ |
| Create new (as observed) | ❌ | ❌ | ✅ | ✅ |
| Edit own profile | ❌ | ✅ | ✅ | ✅ |
| Edit others | ❌ | ❌ | ❌ | ✅ |
| Assign to PASCI matrix | ❌ | ❌ | ✅ | ✅ |
| Promote users | ❌ | ❌ | ❌ | ✅ |
| **Jewels** |
| View own | ❌ | ✅ | ✅ | ✅ |
| View others (metadata only) | ❌ | ✅ | ✅ | ✅ |
| Create/Edit/Delete own | ❌ | ✅ | ✅ | ✅ |
| Delete others | ❌ | ❌ | ❌ | ✅ |
| **Sources** |
| View all | ❌ | ✅ | ✅ | ✅ |
| Create with own jewels | ❌ | ❌ | ✅ | ✅ |
| Edit/Delete any | ❌ | ❌ | ✅ | ✅ |
| Manual sync | ❌ | ❌ | ✅ | ✅ |
| **Activity** |
| View all qupts | ❌ | ✅ | ✅ | ✅ |
| Create qupts | ❌ | ❌ | ✅ | ✅ |
| **MCP** |
| Generate PAT | ❌ | ✅ | ✅ | ✅ |
| OAuth authorization | ❌ | ✅ | ✅ | ✅ |

---

## Database Schema Changes

### 1. Extend `zoku` Table

**File**: `schema.sql`

```sql
-- Add authentication columns to existing zoku table
ALTER TABLE zoku ADD COLUMN access_tier TEXT NOT NULL DEFAULT 'observed'
  CHECK (access_tier IN ('observed', 'coherent', 'entangled', 'prime'));

ALTER TABLE zoku ADD COLUMN email TEXT UNIQUE;  -- Make email unique for auth
ALTER TABLE zoku ADD COLUMN cf_access_sub TEXT;  -- Cloudflare Access subject
ALTER TABLE zoku ADD COLUMN last_login INTEGER;  -- Track last authentication
ALTER TABLE zoku ADD COLUMN created_by TEXT;  -- Track who created the user
ALTER TABLE zoku ADD COLUMN updated_by TEXT;  -- Track who last modified

-- Add index for fast email lookups
CREATE INDEX IF NOT EXISTS idx_zoku_email ON zoku(email);
CREATE INDEX IF NOT EXISTS idx_zoku_cf_sub ON zoku(cf_access_sub);
CREATE INDEX IF NOT EXISTS idx_zoku_access_tier ON zoku(access_tier);
```

**Notes**:
- `email` becomes the primary identifier for authentication
- `cf_access_sub` stores Cloudflare Access JWT `sub` claim for correlation
- `access_tier` defaults to `observed` (must be promoted to gain access)
- Existing `metadata` JSON can store additional auth provider info if needed

### 2. KV Storage for MCP Authentication

**All MCP authentication data stored in KV** (no D1 table needed):

**File**: `wrangler.toml`

```toml
[[kv_namespaces]]
binding = "AUTH_KV"
id = "your-auth-kv-namespace-id"  # Create: wrangler kv:namespace create "AUTH_KV"
preview_id = "your-preview-auth-kv-id"  # Create: wrangler kv:namespace create "AUTH_KV" --preview
```

**KV Keys Structure**:

```typescript
// OAuth tokens (managed by @cloudflare/workers-oauth-provider)
// Keys: oauth:* (library-managed)

// PAT metadata per user (for Account page UI)
// Key: pat:user:{zoku_id}
// Value: JSON array of PatMetadata
[
  {
    id: "tok-abc123",
    name: "CI Script - GitHub Actions",
    created_at: 1700000000,
    expires_at: 1702592000,
    last_used: 1700001000
  }
]

// PAT revocation blocklist (only for revoked tokens)
// Key: pat:revoked:{token_id}
// Value: "1"
// TTL: Automatically set to token expiration (self-cleaning)
```

**Token Format**: JWT (JSON Web Token)

**Notes**:
- **No D1 tables** for MCP authentication (OAuth or PAT)
- **OAuth tokens**: Managed entirely by library in KV
- **PAT tokens**: Self-contained JWTs, validated by signature
- **Revocation**: Blocklist approach in KV with automatic TTL cleanup
- **Performance**: JWT validation ~0.5ms, KV check ~1-2ms (vs 10-20ms for D1)
- **Session caching**: Revocation checked on `initialize` only, cached 5 min for subsequent tool calls

### 3. Add `owner_id` to `jewels` Table

**File**: `schema.sql`

```sql
-- Add ownership to jewels
ALTER TABLE jewels ADD COLUMN owner_id TEXT REFERENCES zoku(id) ON DELETE CASCADE;

-- Index for fast "my jewels" queries
CREATE INDEX IF NOT EXISTS idx_jewels_owner ON jewels(owner_id);
```

**Migration Required**: Existing jewels need owner assignment (see Migration Strategy).

### 4. Create `audit_log` Table

**File**: `schema.sql`

```sql
-- Audit trail for sensitive operations
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,  -- log-{uuid}
  timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
  zoku_id TEXT,  -- NULL for system actions
  action TEXT NOT NULL,  -- 'create', 'update', 'delete', 'promote', 'revoke'
  resource_type TEXT NOT NULL,  -- 'entanglement', 'jewel', 'source', 'user'
  resource_id TEXT NOT NULL,  -- ID of affected resource
  details TEXT,  -- JSON with action-specific details
  ip_address TEXT,  -- Client IP (from CF-Connecting-IP)
  user_agent TEXT,  -- Client user agent
  request_id TEXT  -- Correlate with structured logs
);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_zoku ON audit_log(zoku_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);
```

**Notes**:
- Immutable append-only log
- Separate from structured application logs (console)
- Queryable for compliance/forensics
- Request ID links to application logs

### 5. Updated `zoku` Type Definition

**File**: `src/types.ts`

```typescript
export interface Zoku {
  id: string;
  name: string;
  type: 'human' | 'agent';
  email: string | null;  // Required for humans with access
  access_tier: 'observed' | 'coherent' | 'entangled' | 'prime';
  cf_access_sub: string | null;  // Cloudflare Access subject claim
  last_login: number | null;
  created_by: string | null;  // zoku_id of creator
  updated_by: string | null;  // zoku_id of last modifier
  metadata: string | null;  // JSON blob
  created_at: number;
}

export interface AuditLog {
  id: string;
  timestamp: number;
  zoku_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  details: string | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
}
```

---

## Cloudflare Access Integration

### Overview

Cloudflare Access acts as the identity provider for frontend web access. Users authenticate via CF Access (email OTP, SSO, etc.), and the JWT is passed to our application for validation.

### Configuration

#### Cloudflare Access Setup

1. **Create Access Application** (Cloudflare Dashboard)
   - Type: Self-hosted
   - Application URL: `https://zoku.205.dev`
   - Session Duration: 24 hours
   - Identity Providers: Google Workspace, Email OTP, etc.

2. **Access Policy**
   - Allow: `Email ends with @reset.tech` (or specific allow list)
   - Default Action: Allow (new users get Coherent tier)

3. **Note Application AUD Tag**
   - Found in: Applications → Configure → Basic Information
   - Example: `abc123def456...`
   - Required for JWT validation

#### Environment Variables

**Production** (`wrangler.toml` secrets):
```bash
wrangler secret put CF_ACCESS_TEAM_DOMAIN
# Value: https://<your-team>.cloudflareaccess.com

wrangler secret put CF_ACCESS_AUD
# Value: abc123def456...

wrangler secret put JWT_SECRET
# Value: (generate 32-byte random string)
```

**Development** (`.dev.vars`):
```bash
CF_ACCESS_TEAM_DOMAIN=https://your-team.cloudflareaccess.com
CF_ACCESS_AUD=abc123def456...
JWT_SECRET=dev-secret-32-chars-minimum-12345
DEV_AUTH_BYPASS=true  # Skip CF Access validation
DEV_USER_EMAIL=dev@reset.tech  # Mock user for development
```

### JWT Validation Implementation

**File**: `src/lib/cf-access.ts` (new file)

```typescript
import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { Bindings } from './types';

interface CloudflareAccessPayload {
  sub: string;      // Unique user ID from CF Access
  email: string;    // User email
  iss: string;      // Issuer
  aud: string[];    // Audience
  iat: number;      // Issued at
  exp: number;      // Expires at
  custom?: Record<string, any>;  // Custom claims
}

/**
 * Validates Cloudflare Access JWT token
 * @throws {Error} if token is invalid or expired
 */
export async function validateCloudflareAccessToken(
  token: string,
  env: Bindings
): Promise<CloudflareAccessPayload> {
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
    throw new Error(`CF Access JWT validation failed: ${error.message}`);
  }
}

/**
 * Extracts JWT from request headers
 */
export function extractCloudflareAccessToken(request: Request): string | null {
  return request.headers.get('cf-access-jwt-assertion');
}
```

**Dependencies**: Add to `package.json`:
```json
{
  "dependencies": {
    "jose": "^5.2.0"
  }
}
```

### Token Validation Flow

```
1. Request arrives with `cf-access-jwt-assertion` header
2. Extract JWT from header
3. Fetch Cloudflare's public keys (JWKS)
4. Verify JWT signature against public keys
5. Verify issuer matches team domain
6. Verify audience matches application AUD
7. Verify token not expired
8. Extract email and sub from payload
9. Look up user in zoku table by email
10. If not exists, create as Coherent tier
11. Update last_login timestamp
12. Attach user context to request
```

---

## Authentication Middleware

### Core Middleware

**File**: `src/middleware/auth.ts` (new file)

```typescript
import { Context, Next } from 'hono';
import { Logger } from '../lib/logger';
import { validateCloudflareAccessToken, extractCloudflareAccessToken } from '../lib/cf-access';
import { DB } from '../db';
import type { Bindings, Zoku } from '../types';

// Extend Hono context with auth data
export interface AuthContext {
  user: Zoku;
  requestId: string;
}

/**
 * Authentication middleware for web requests
 * Validates Cloudflare Access JWT and loads user
 */
export function authMiddleware() {
  return async (c: Context, next: Next) => {
    const env = c.env as Bindings;
    const logger = new Logger(env, { request_id: c.get('requestId') });

    // Development bypass
    if (env.DEV_AUTH_BYPASS === 'true' && env.DEV_USER_EMAIL) {
      const db = new DB(env.DB);
      let user = await db.getZokuByEmail(env.DEV_USER_EMAIL);

      if (!user) {
        // Create dev user with Prime access
        user = await db.createZoku({
          name: 'Dev User',
          type: 'human',
          email: env.DEV_USER_EMAIL,
          access_tier: 'prime',
        });
      }

      c.set('user', user);
      logger.info('Dev auth bypass enabled', { user_id: user.id });
      return next();
    }

    // Extract JWT
    const token = extractCloudflareAccessToken(c.req.raw);
    if (!token) {
      logger.warn('Missing CF Access JWT');
      return c.json({ error: 'Authentication required' }, 401);
    }

    try {
      // Validate JWT
      const payload = await validateCloudflareAccessToken(token, env);
      logger.info('CF Access token validated', { email: payload.email });

      // Load or create user
      const db = new DB(env.DB);
      let user = await db.getZokuByEmail(payload.email);

      if (!user) {
        // First-time user: auto-create as Coherent (read-only)
        user = await db.createZoku({
          name: payload.email.split('@')[0],  // Use email prefix as name
          type: 'human',
          email: payload.email,
          access_tier: 'coherent',
          cf_access_sub: payload.sub,
        });
        logger.info('New user auto-created', { user_id: user.id, tier: 'coherent' });
      } else if (user.access_tier === 'observed') {
        // Existing user was pre-created for PASCI matrix but never authenticated
        // Auto-promote to Coherent on first login
        await db.updateZokuTier(user.id, 'coherent');
        user.access_tier = 'coherent';
        logger.info('User auto-promoted from observed to coherent', { user_id: user.id });
      }

      // Update last login
      await db.updateZoku(user.id, {
        last_login: Math.floor(Date.now() / 1000),
        cf_access_sub: payload.sub  // Update sub if changed
      });

      // Attach user to context
      c.set('user', user);
      logger.info('User authenticated', {
        user_id: user.id,
        tier: user.access_tier
      });

      return next();
    } catch (error) {
      logger.error('Authentication failed', { error: error.message });
      return c.json({ error: 'Invalid authentication token' }, 401);
    }
  };
}

/**
 * Authorization middleware - checks if user has required tier
 */
export function requireTier(minTier: 'coherent' | 'entangled' | 'prime') {
  const tierLevels = {
    observed: 0,
    coherent: 1,
    entangled: 2,
    prime: 3,
  };

  return async (c: Context, next: Next) => {
    const user = c.get('user') as Zoku;
    const env = c.env as Bindings;
    const logger = new Logger(env, { request_id: c.get('requestId'), user_id: user.id });

    if (tierLevels[user.access_tier] < tierLevels[minTier]) {
      logger.warn('Insufficient permissions', {
        has: user.access_tier,
        needs: minTier
      });
      return c.json({
        error: 'Insufficient permissions',
        message: `This action requires ${minTier} access or higher`
      }, 403);
    }

    return next();
  };
}

/**
 * MCP token authentication middleware
 * Validates Bearer token from Authorization header
 * Uses session-aware caching: full check on initialize, cached for tool calls
 */
export async function mcpAuthMiddleware(c: Context, next: Next) {
  const env = c.env as Bindings;
  const logger = new Logger(env, { request_id: c.get('requestId') });

  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    logger.warn('Missing MCP auth token');
    return c.json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Authentication required' },
      id: null
    }, 401);
  }

  const token = authHeader.substring(7);  // Remove "Bearer "

  try {
    // Parse request to detect initialize method
    const body = await c.req.json();
    const isInitialize = body.method === 'initialize';

    // Validate token with session awareness
    const db = new DB(env.DB);
    const user = await validateMcpToken(token, env, db, isInitialize);

    c.set('user', user);
    c.set('mcpRequest', body);  // Store for handler
    logger.info('MCP token validated', {
      user_id: user.id,
      method: body.method,
      cached: !isInitialize
    });

    return next();
  } catch (error) {
    logger.error('MCP auth failed', { error: error.message });
    return c.json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Invalid token' },
      id: null
    }, 401);
  }
}
```

### Apply Middleware to Routes

**File**: `src/index.ts`

```typescript
import { authMiddleware, requireTier } from './middleware/auth';

// Apply to all frontend routes
app.use('/api/*', authMiddleware());

// Example: Entanglement creation requires Entangled tier
app.post('/api/entanglements', requireTier('entangled'), async (c) => {
  const user = c.get('user');
  // ... create entanglement, log user_id as creator
});

// Example: User promotion requires Prime tier
app.patch('/api/zoku/:id/tier', requireTier('prime'), async (c) => {
  // ... update access tier
});

// MCP routes use different auth
app.post('/mcp', mcpAuthMiddleware, async (c) => {
  // ... handle MCP request
});
```

---

## Jewel Ownership & Permissions

### Ownership Model

**Current**: Jewels are system-wide, anyone can use any jewel
**New**: Each jewel is owned by a specific user

### Changes Required

#### 1. Database Column Addition

Already covered in schema changes: `ALTER TABLE jewels ADD COLUMN owner_id`

#### 2. API Changes

**File**: `src/api/jewels.ts`

```typescript
// CREATE: Auto-assign owner
app.post('/api/jewels', requireTier('coherent'), async (c) => {
  const user = c.get('user') as Zoku;
  const body = await c.req.json();

  const jewel = await db.createJewel({
    ...body,
    owner_id: user.id,  // Auto-assign
  });

  // Audit log
  await db.createAuditLog({
    zoku_id: user.id,
    action: 'create',
    resource_type: 'jewel',
    resource_id: jewel.id,
  });

  return c.json({ jewel });
});

// LIST: Show own jewels + others' metadata
app.get('/api/jewels', authMiddleware(), async (c) => {
  const user = c.get('user') as Zoku;
  const jewels = await db.listJewels();

  // Filter encrypted data for jewels owned by others
  const filtered = jewels.map(jewel => {
    if (jewel.owner_id !== user.id && user.access_tier !== 'prime') {
      return {
        ...jewel,
        data: '[REDACTED - owned by another user]',
        validation_metadata: jewel.validation_metadata,  // Safe to show
      };
    }
    return jewel;
  });

  return c.json({ jewels: filtered });
});

// DELETE: Own jewels only (Prime can delete any)
app.delete('/api/jewels/:id', requireTier('coherent'), async (c) => {
  const user = c.get('user') as Zoku;
  const jewel = await db.getJewel(c.req.param('id'));

  if (!jewel) {
    return c.json({ error: 'Jewel not found' }, 404);
  }

  // Check ownership or Prime permission
  if (jewel.owner_id !== user.id && user.access_tier !== 'prime') {
    return c.json({ error: 'Can only delete your own jewels' }, 403);
  }

  await db.deleteJewel(jewel.id);
  await db.createAuditLog({
    zoku_id: user.id,
    action: 'delete',
    resource_type: 'jewel',
    resource_id: jewel.id,
  });

  return c.json({ success: true });
});
```

#### 3. Source Creation Permission

**File**: `src/api/entanglements.ts` (POST sources endpoint)

```typescript
// Add source: Must use own jewel or be Prime
app.post('/api/entanglements/:id/sources', requireTier('entangled'), async (c) => {
  const user = c.get('user') as Zoku;
  const body = await c.req.json();

  if (body.jewel_id) {
    const jewel = await db.getJewel(body.jewel_id);

    // Verify jewel ownership
    if (jewel.owner_id !== user.id && user.access_tier !== 'prime') {
      return c.json({
        error: 'Can only use your own jewels',
        message: 'Select a jewel you own or ask an admin to add this source'
      }, 403);
    }
  }

  // ... proceed with source creation
});
```

### Permission Summary

| Action | Coherent | Entangled | Prime |
|--------|----------|-----------|-------|
| Create own jewel | ✅ | ✅ | ✅ |
| View own jewel (full) | ✅ | ✅ | ✅ |
| View others' jewels (metadata) | ✅ | ✅ | ✅ |
| Edit/Delete own jewel | ✅ | ✅ | ✅ |
| Delete others' jewels | ❌ | ❌ | ✅ |
| Use own jewel for sources | ❌ | ✅ | ✅ |
| Use others' jewels | ❌ | ❌ | ✅ |

---

## Frontend Authentication

### Production Flow

```
1. User visits https://zoku.205.dev
2. Cloudflare Access intercepts (not authenticated)
3. User redirected to CF Access login
4. User authenticates (email OTP, Google, etc.)
5. CF Access issues JWT, sets cookie, redirects to app
6. App receives request with cf-access-jwt-assertion header
7. App validates JWT, extracts email
8. App looks up user in database by email
9. If not found, create as Coherent tier
10. If found but tier=observed, show 403 page
11. If found with access, load app with user context
```

### Frontend Changes

#### 1. API Client Token Management

**File**: `frontend/src/lib/api.ts`

```typescript
// No changes needed for CF Access!
// JWT is in HTTP-only cookie, browser sends automatically

function getHeaders(additionalHeaders?: Record<string, string>): HeadersInit {
  return {
    'X-Zoku-Session-ID': SESSION_ID,  // Keep for logging
    ...additionalHeaders
  }
}

// All fetch calls work as-is, CF Access JWT sent by browser
```

#### 2. User Context Provider

**File**: `frontend/src/lib/auth.tsx` (new file)

```typescript
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';
import type { Zoku } from './types';

interface AuthContextType {
  user: Zoku | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  refetch: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Zoku | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = async () => {
    try {
      setLoading(true);
      // New endpoint to get current user
      const response = await api.getCurrentUser();
      setUser(response.user);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, refetch: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

#### 3. Current User Endpoint

**File**: `src/api/zoku.ts`

```typescript
// GET current authenticated user
app.get('/api/zoku/me', authMiddleware(), async (c) => {
  const user = c.get('user') as Zoku;

  return c.json({ user });
});

// POST create new zoku (Entangled and Prime only)
app.post('/api/zoku', authMiddleware(), requireTier('entangled'), async (c) => {
  const currentUser = c.get('user') as Zoku;
  const body = await c.req.json();
  const db = new DB(c.env.DB);

  // Entangled users can only create as 'observed'
  // Prime users can create with any tier
  let access_tier = 'observed';  // Default for Entangled

  if (currentUser.access_tier === 'prime' && body.access_tier) {
    // Only admins can set tier on creation
    access_tier = body.access_tier;
  }

  const zoku = await db.createZoku({
    name: body.name,
    type: body.type || 'human',
    email: body.email || null,
    access_tier,
    created_by: currentUser.id,
  });

  await db.createAuditLog({
    zoku_id: currentUser.id,
    action: 'create',
    resource_type: 'zoku',
    resource_id: zoku.id,
    details: JSON.stringify({ tier: access_tier }),
  });

  return c.json({ zoku });
});

// PATCH promote/demote user tier (Prime only)
app.patch('/api/zoku/:id/tier', authMiddleware(), requireTier('prime'), async (c) => {
  const currentUser = c.get('user') as Zoku;
  const targetId = c.req.param('id');
  const body = await c.req.json();
  const db = new DB(c.env.DB);

  const targetUser = await db.getZoku(targetId);
  if (!targetUser) {
    return c.json({ error: 'User not found' }, 404);
  }

  const oldTier = targetUser.access_tier;
  const newTier = body.access_tier;

  await db.updateZokuTier(targetId, newTier);

  await db.createAuditLog({
    zoku_id: currentUser.id,
    action: 'promote',
    resource_type: 'zoku',
    resource_id: targetId,
    details: JSON.stringify({ from: oldTier, to: newTier }),
  });

  return c.json({ success: true, tier: newTier });
});
```

**Key Points**:
- Entangled tier can create Zoku but **only as `observed`**
- Prime tier can create Zoku with any tier
- Only Prime tier can promote/demote users
- All tier changes are audit logged

#### 4. Account Page

**File**: `frontend/src/components/AccountPage.tsx` (new file)

```tsx
import { useAuth } from '../lib/auth';
import { useState } from 'react';
import { api } from '../lib/api';

export default function AccountPage() {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [showNewToken, setShowNewToken] = useState<string | null>(null);
  const [tokenName, setTokenName] = useState('');
  const [tokenExpiration, setTokenExpiration] = useState<30 | 60 | 90 | 365>(90);
  const [showTokenForm, setShowTokenForm] = useState(false);

  const generateToken = async () => {
    const { token, record } = await api.createMcpToken({
      name: tokenName || 'Personal Access Token',
      expires_in_days: tokenExpiration,
    });

    // Show token once (never stored)
    setShowNewToken(token);
    setTokens([...tokens, record]);
    setShowTokenForm(false);
    setTokenName('');
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2>Account Information</h2>
        <dl>
          <dt>Name</dt>
          <dd>{user?.name}</dd>
          <dt>Email</dt>
          <dd>{user?.email}</dd>
          <dt>Access Tier</dt>
          <dd><span className="badge">{user?.access_tier}</span></dd>
        </dl>
      </div>

      <div className="card">
        <h2>MCP Server Access</h2>

        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded">
          <h3 className="text-sm font-semibold mb-2">✨ Recommended: OAuth (Automatic)</h3>
          <p className="text-sm mb-2">
            Modern MCP clients like Claude Desktop support OAuth - just add the URL and authorize:
          </p>
          <pre className="text-xs bg-white p-2 rounded">{`{
  "mcpServers": {
    "the-great-game": {
      "url": "https://zoku.205.dev/mcp"
    }
  }
}`}</pre>
          <p className="text-xs text-gray-600 mt-2">
            The client will automatically open your browser to authorize access.
          </p>
        </div>

        <div className="border-t pt-4 mt-4">
          <h3 className="font-semibold mb-2">Personal Access Tokens (Manual)</h3>
          <p className="text-sm mb-4">
            For clients that don't support OAuth, or for scripts/automation.
          </p>

          {!showTokenForm ? (
            <button onClick={() => setShowTokenForm(true)} className="btn btn-secondary">
              Generate Personal Access Token
            </button>
          ) : (
            <div className="space-y-3 p-4 bg-gray-50 rounded">
              <div>
                <label className="block text-sm mb-1">Token Name</label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="CI Script, Legacy Client, etc."
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Expiration</label>
                <select
                  value={tokenExpiration}
                  onChange={(e) => setTokenExpiration(Number(e.target.value) as 30 | 60 | 90 | 365)}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days (recommended)</option>
                  <option value={365}>365 days</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={generateToken} className="btn btn-primary">Generate Token</button>
                <button onClick={() => setShowTokenForm(false)} className="btn btn-secondary">Cancel</button>
              </div>
            </div>
          )}
        </div>

        {showNewToken && (
          <div className="alert alert-warning">
            <strong>Save this token now - it won't be shown again!</strong>
            <code>{showNewToken}</code>
          </div>
        )}

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Created</th>
              <th>Last Used</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map(token => (
              <tr key={token.id}>
                <td>{token.name}</td>
                <td>{new Date(token.created_at * 1000).toLocaleDateString()}</td>
                <td>{token.last_used ? new Date(token.last_used * 1000).toLocaleDateString() : 'Never'}</td>
                <td>
                  <button onClick={() => revokeToken(token.id)}>Revoke</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <details className="mt-4">
          <summary>MCP Configuration Instructions</summary>
          <pre>{`
// Add to your MCP client configuration (e.g., Claude Desktop)
{
  "mcpServers": {
    "the-great-game": {
      "url": "https://zoku.205.dev/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}
          `}</pre>
        </details>
      </div>
    </div>
  );
}
```

#### 5. Permission-Based UI

**File**: `frontend/src/components/Dashboard.tsx`

```tsx
import { useAuth } from '../lib/auth';

export default function Dashboard() {
  const { user } = useAuth();

  const canWrite = user?.access_tier === 'entangled' || user?.access_tier === 'prime';

  return (
    <div>
      {/* Show create buttons only if user has write access */}
      {canWrite && (
        <button onClick={createEntanglement}>Create Entanglement</button>
      )}

      {/* Everyone can view */}
      <EntanglementsList />
    </div>
  );
}
```

### 403 Access Denied Page

**File**: `frontend/src/components/AccessDenied.tsx` (new file)

```tsx
export default function AccessDenied() {
  return (
    <div className="error-page">
      <h1>Access Denied</h1>
      <p>
        Your account exists in the system but has not been granted access.
        Contact a system administrator to request access.
      </p>
      <p>
        <strong>Email:</strong> admin@reset.tech
      </p>
    </div>
  );
}
```

---

## MCP Authentication

### Two Authentication Methods

The MCP server supports two authentication methods: OAuth 2.1 (primary, automatic) and Personal Access Tokens (fallback, manual). OAuth is enabled by default and provides the best user experience with short-lived tokens and browser-based authorization.

#### Method 1: OAuth 2.1 (Primary - Default)

**Use Case**: Automatic authorization, short-lived tokens, seamless UX

**Status**: Primary authentication method, implemented in Phase 4

**Why OAuth First**:
- Modern MCP clients (Claude Desktop, etc.) support OAuth by default
- Better security with short-lived access tokens + refresh tokens
- No manual token management required by users
- Automatic token refresh
- Easy revocation without losing all access

**Architecture**: Using Cloudflare's official `workers-oauth-provider` library

**Library Choice**: We use `@cloudflare/workers-oauth-provider` instead of rolling our own:
- ✅ Security-reviewed by Cloudflare team
- ✅ RFC-compliant (OAuth 2.1, PKCE, RFC 8414)
- ✅ Battle-tested in production
- ✅ Automatic token refresh and rotation
- ✅ Built specifically for Workers environment
- ✅ Significantly less code to maintain (~500 lines saved)

**OAuth Flow Sequence**:

```
1. User adds MCP server URL to Claude Desktop: https://zoku.205.dev/mcp
2. Client discovers OAuth endpoints via /.well-known/oauth-authorization-server (library)
3. Client initiates authorization with PKCE code challenge
4. User redirected to https://zoku.205.dev/oauth/authorize (our UI)
5. Backend validates user via CF Access JWT (our middleware)
6. User sees authorization page: "Claude Desktop wants to access The Great Game"
7. User clicks "Authorize"
8. Backend calls library's completeAuthorization() with user props
9. Library generates auth code, redirects to client callback (automatic)
10. Client exchanges auth code for tokens (library handles)
11. Library stores tokens in KV, returns access + refresh token
12. Client uses access token for MCP requests
13. When access token expires, client auto-refreshes (library handles)
```

**OAuth Endpoints**:

| Endpoint | Handled By | Purpose |
|----------|------------|---------|
| `/.well-known/oauth-authorization-server` | Library | Server metadata discovery (RFC 8414) |
| `/oauth/authorize` (GET) | **Our code** | Show authorization page with CF Access |
| `/oauth/authorize` (POST) | **Our code** | User approval, calls library |
| `/oauth/token` | Library | Token exchange & refresh |
| `/oauth/revoke` | Library | Token revocation |

**Dependencies**:

Add to `package.json`:
```json
{
  "dependencies": {
    "@cloudflare/workers-oauth-provider": "^0.1.0",
    "jose": "^5.2.0"
  }
}
```

Add to `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "OAUTH_KV"
id = "your-kv-namespace-id"  # Create: wrangler kv:namespace create "OAUTH_KV"
preview_id = "your-preview-kv-id"  # Create: wrangler kv:namespace create "OAUTH_KV" --preview
```

**Implementation**:

**File**: `src/lib/oauth-setup.ts` (new file)

```typescript
import { OAuthProvider } from '@cloudflare/workers-oauth-provider';
import type { Bindings } from '../types';

/**
 * Setup and configure OAuth provider
 * Uses Cloudflare's official workers-oauth-provider library
 */
export function setupOAuthProvider(env: Bindings): OAuthProvider {
  return new OAuthProvider({
    kvNamespace: env.OAUTH_KV,
    authorizationEndpoint: `${env.APP_URL}/oauth/authorize`,
    tokenEndpoint: `${env.APP_URL}/oauth/token`,
    issuer: env.APP_URL,
    scopesSupported: ['mcp'],
    refreshTokenTTL: 2592000,  // 30 days in seconds

    // Inject user data into token props
    // These props are available when validating tokens
    tokenExchangeCallback: async (ctx) => {
      // Props from completeAuthorization() are available here
      // We can add additional data if needed
      return {
        ...ctx.props,
        issued_at: Date.now(),
      };
    },

    // Custom error handling
    onError: (error) => {
      console.error('[OAuth Error]', {
        message: error.message,
        stack: error.stack,
      });
    }
  });
}
```

**OAuth API Endpoints**:

**File**: `src/api/mcp-oauth.ts` (new file - for MCP authentication)

**Note**: `src/api/google-oauth.ts` already exists for Google Drive/Docs jewel OAuth - this is separate.

```typescript
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { setupOAuthProvider } from '../lib/oauth-setup';
import { DB } from '../db';
import type { Zoku } from '../types';

const app = new Hono();

// Initialize OAuth provider (will be used by middleware)
let oauthProvider: ReturnType<typeof setupOAuthProvider>;

// Authorization endpoint (user authorization page)
app.get('/oauth/authorize', authMiddleware(), async (c) => {
  const user = c.get('user') as Zoku;
  const query = c.req.query();

  // Validate required OAuth parameters
  const {
    client_id,
    redirect_uri,
    response_type,
    state,
    code_challenge,
    code_challenge_method,
  } = query;

  if (!client_id || !redirect_uri || response_type !== 'code' || !code_challenge) {
    return c.html(`
      <h1>Invalid OAuth Request</h1>
      <p>Missing required parameters or unsupported response type.</p>
    `, 400);
  }

  if (code_challenge_method !== 'S256') {
    return c.html(`
      <h1>Invalid OAuth Request</h1>
      <p>Only S256 PKCE method is supported.</p>
    `, 400);
  }

  // Check user tier (must have access)
  if (user.access_tier === 'observed') {
    return c.html(`
      <h1>Access Denied</h1>
      <p>Your account has no access. Contact an administrator.</p>
    `, 403);
  }

  // Show authorization page
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Authorize MCP Client</title>
      <style>
        body {
          font-family: system-ui;
          max-width: 500px;
          margin: 50px auto;
          padding: 20px;
        }
        .card {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 30px;
          background: #f9f9f9;
        }
        h1 { margin-top: 0; }
        .user-info {
          background: white;
          padding: 15px;
          border-radius: 4px;
          margin: 20px 0;
        }
        button {
          padding: 12px 24px;
          font-size: 16px;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          margin-right: 10px;
        }
        .approve { background: #0066cc; color: white; }
        .deny { background: #ccc; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Authorize MCP Client</h1>
        <p><strong>${client_id}</strong> wants to access The Great Game MCP server.</p>

        <div class="user-info">
          <strong>Signed in as:</strong> ${user.email}<br>
          <strong>Access Tier:</strong> ${user.access_tier}
        </div>

        <p>This will allow the client to:</p>
        <ul>
          <li>View and manage entanglements</li>
          <li>View and manage zoku</li>
          <li>Access qupts and sources</li>
          <li>Perform actions based on your access tier (${user.access_tier})</li>
        </ul>

        <form method="POST" action="/oauth/authorize">
          <input type="hidden" name="client_id" value="${client_id}">
          <input type="hidden" name="redirect_uri" value="${redirect_uri}">
          <input type="hidden" name="state" value="${state || ''}">
          <input type="hidden" name="code_challenge" value="${code_challenge}">
          <input type="hidden" name="code_challenge_method" value="${code_challenge_method}">

          <button type="submit" name="action" value="approve" class="approve">
            Authorize
          </button>
          <button type="submit" name="action" value="deny" class="deny">
            Deny
          </button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// Authorization approval (POST from authorization page)
app.post('/oauth/authorize', authMiddleware(), async (c) => {
  const user = c.get('user') as Zoku;
  const body = await c.req.parseBody();

  if (body.action !== 'approve') {
    // User denied
    const redirect = new URL(body.redirect_uri as string);
    redirect.searchParams.set('error', 'access_denied');
    if (body.state) redirect.searchParams.set('state', body.state as string);
    return c.redirect(redirect.toString());
  }

  // Initialize provider if needed
  if (!oauthProvider) {
    oauthProvider = setupOAuthProvider(c.env);
  }

  // Complete authorization using library
  // The library handles: code generation, PKCE storage, redirect
  const request = new Request(c.req.url, {
    method: 'POST',
    headers: c.req.raw.headers,
    body: new URLSearchParams({
      client_id: body.client_id as string,
      redirect_uri: body.redirect_uri as string,
      state: (body.state as string) || '',
      code_challenge: body.code_challenge as string,
      code_challenge_method: body.code_challenge_method as string,
      user_id: user.id,  // Pass user context to library
    }),
  });

  const response = await oauthProvider.completeAuthorization(request);
  return new Response(response.body, response);
});

// Mount OAuth provider middleware for remaining endpoints
// This handles: /.well-known/*, /oauth/token, /oauth/revoke
app.use('*', async (c, next) => {
  if (!oauthProvider) {
    oauthProvider = setupOAuthProvider(c.env);
  }

  // Let the library handle all other OAuth endpoints
  const path = new URL(c.req.url).pathname;
  if (
    path.startsWith('/.well-known/oauth-') ||
    path === '/oauth/token' ||
    path === '/oauth/revoke'
  ) {
    const response = await oauthProvider.handleRequest(c.req.raw);
    return new Response(response.body, response);
  }

  return next();
});

export default app;
```

**Route Structure**:
```typescript
// In src/index.ts
app.route('/oauth', mcpOAuthRoutes);        // MCP user authentication (this file)
app.route('/api/oauth', googleOAuthRoutes); // Google OAuth for jewels (google-oauth.ts)
```

**Notes**:
- **Metadata endpoints** (`/.well-known/oauth-*`): Automatically handled by library
- **Token exchange** (`/oauth/token`): Automatically handled by library with PKCE validation
- **Token refresh**: Automatically handled by library with rotation
- **Token revocation** (`/oauth/revoke`): Automatically handled by library
- **Storage**: OAuth tokens stored in KV (configured via `OAUTH_KV` binding)
- **We only implement**: Authorization UI (GET) and approval handler (POST)

**Client Usage** (automatic in modern MCP clients):

```json
{
  "mcpServers": {
    "the-great-game": {
      "url": "https://zoku.205.dev/mcp"
    }
  }
}
```

Client automatically:
1. Discovers OAuth endpoints
2. Opens browser for authorization
3. Exchanges code for tokens
4. Refreshes tokens automatically

---

#### Method 2: Personal Access Token (PAT - Fallback)

**Use Case**: Manual configuration for clients that don't support OAuth, long-lived access

**Token Format**: JWT (JSON Web Token)
**Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ6b2t1LTEyMyIsImp0aSI6InRvay0xMjMiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMjU5MjAwMH0.signature`

**When to Use PAT**:
- Legacy MCP clients without OAuth support
- Automated scripts/CI environments
- Testing and development
- User preference for manual token management

**Token Generation Flow**:

```
1. User visits Account page (authenticated via CF Access)
2. Clicks "Generate Personal Access Token"
3. Names token (e.g., "CI Script - GitHub Actions")
4. Selects expiration: 30, 60, 90, or 365 days
5. Backend generates JWT with user_id, tier, expiration
6. Backend stores metadata in KV: pat:user:{user_id} (array of token info)
7. Backend returns JWT to frontend ONCE
8. User copies token, adds to MCP client config
9. Token never shown again (JWT is self-contained)
```

**JWT Claims**:
```json
{
  "sub": "zoku-123",           // User ID
  "jti": "tok-abc123",         // Token ID (for revocation)
  "name": "CI Script",         // User-provided name
  "tier": "coherent",          // Access tier (cached)
  "iat": 1700000000,           // Issued at
  "exp": 1702592000            // Expires at
}
```

**KV Storage Structure**:

```typescript
// User's token list (for Account page UI)
// Key: pat:user:{zoku_id}
// Value: Array of token metadata
[
  {
    id: "tok-abc123",
    name: "CI Script - GitHub Actions",
    created_at: 1700000000,
    expires_at: 1702592000,
    last_used: 1700001000  // Updated on revocation check
  }
]

// Revocation blocklist (only for revoked tokens)
// Key: pat:revoked:{jti}
// Value: "1"
// TTL: token expiration (auto-cleanup)
```

**Implementation**:

**File**: `src/lib/mcp-tokens.ts` (new file)

```typescript
import { Bindings, Zoku } from '../types';
import { SignJWT, jwtVerify } from 'jose';
import { DB } from '../db';

const JWT_SECRET_KEY = 'JWT_SECRET';  // Cloudflare secret

// In-memory cache for token validation (per-worker instance)
// Avoids KV revocation check on every tool call
const tokenCache = new Map<string, { user: Zoku; cachedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface PatMetadata {
  id: string;
  name: string;
  created_at: number;
  expires_at: number;
  last_used: number | null;
}

/**
 * Generate a new MCP Personal Access Token (JWT)
 * Returns the signed JWT and metadata
 */
export async function generateMcpToken(
  env: Bindings,
  db: DB,
  zoku_id: string,
  name: string,
  expiresInDays: 30 | 60 | 90 | 365
): Promise<{ token: string; metadata: PatMetadata }> {
  const user = await db.getZoku(zoku_id);
  if (!user) throw new Error('User not found');

  const tokenId = `tok-${crypto.randomUUID()}`;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + expiresInDays * 86400;

  // Sign JWT
  const secret = new TextEncoder().encode(env[JWT_SECRET_KEY]);
  const token = await new SignJWT({
    name,
    tier: user.access_tier,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(zoku_id)
    .setJti(tokenId)
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(secret);

  // Store metadata in KV
  const metadata: PatMetadata = {
    id: tokenId,
    name,
    created_at: now,
    expires_at: expiresAt,
    last_used: null,
  };

  const kvKey = `pat:user:${zoku_id}`;
  const existing = await env.AUTH_KV.get(kvKey, 'json') || [];
  existing.push(metadata);
  await env.AUTH_KV.put(kvKey, JSON.stringify(existing));

  return { token, metadata };
}

/**
 * Validate MCP token and return user
 * Supports both OAuth tokens (from KV) and PATs (JWT)
 * Uses session-aware caching: full check on initialize, cached on subsequent calls
 *
 * @param token - Bearer token from Authorization header
 * @param env - Cloudflare bindings
 * @param db - Database instance
 * @param isInitialize - True if this is an MCP initialize request
 */
export async function validateMcpToken(
  token: string,
  env: Bindings,
  db: DB,
  isInitialize: boolean = false
): Promise<Zoku> {
  // Try OAuth first (library-based validation)
  try {
    const { setupOAuthProvider } = await import('./oauth-setup');
    const oauthProvider = setupOAuthProvider(env);
    const tokenData = await oauthProvider.validateAccessToken(token);

    if (tokenData?.props?.user_id) {
      const user = await db.getZoku(tokenData.props.user_id);
      if (!user) throw new Error('User not found');
      if (user.access_tier === 'observed') throw new Error('Access revoked');
      return user;
    }
  } catch (error) {
    // Not an OAuth token, try PAT
  }

  // PAT validation (JWT-based)
  try {
    // Verify JWT signature
    const secret = new TextEncoder().encode(env[JWT_SECRET_KEY]);
    const { payload } = await jwtVerify(token, secret);

    const jti = payload.jti as string;
    const userId = payload.sub as string;

    // Check cache (skip revocation check unless initialize or cache expired)
    const cached = tokenCache.get(jti);
    if (!isInitialize && cached && (Date.now() - cached.cachedAt < CACHE_TTL)) {
      return cached.user;
    }

    // Check revocation in KV (only on initialize or cache miss)
    const isRevoked = await env.AUTH_KV.get(`pat:revoked:${jti}`);
    if (isRevoked) {
      tokenCache.delete(jti);  // Clear cache
      throw new Error('Token has been revoked');
    }

    // Load user from D1
    const user = await db.getZoku(userId);
    if (!user) throw new Error('User not found');
    if (user.access_tier === 'observed') throw new Error('Access revoked');

    // Update last_used timestamp (async, don't wait)
    if (isInitialize) {
      updateLastUsed(env, userId, jti).catch(console.error);
    }

    // Cache for subsequent requests in this session
    tokenCache.set(jti, { user, cachedAt: Date.now() });

    return user;
  } catch (error) {
    throw new Error(`Token validation failed: ${error.message}`);
  }
}

/**
 * Update last_used timestamp for a PAT (async, non-blocking)
 */
async function updateLastUsed(
  env: Bindings,
  userId: string,
  tokenId: string
): Promise<void> {
  const kvKey = `pat:user:${userId}`;
  const tokens = (await env.AUTH_KV.get(kvKey, 'json')) as PatMetadata[] || [];

  const updated = tokens.map((t) =>
    t.id === tokenId ? { ...t, last_used: Math.floor(Date.now() / 1000) } : t
  );

  await env.AUTH_KV.put(kvKey, JSON.stringify(updated));
}

/**
 * Revoke a PAT by adding it to the blocklist
 */
export async function revokeMcpToken(
  env: Bindings,
  userId: string,
  tokenId: string
): Promise<void> {
  // Get token metadata to find expiration
  const kvKey = `pat:user:${userId}`;
  const tokens = (await env.AUTH_KV.get(kvKey, 'json')) as PatMetadata[] || [];
  const token = tokens.find((t) => t.id === tokenId);

  if (!token) throw new Error('Token not found');

  // Add to blocklist with TTL = time until expiration
  const ttl = Math.max(0, token.expires_at - Math.floor(Date.now() / 1000));
  await env.AUTH_KV.put(`pat:revoked:${tokenId}`, '1', { expirationTtl: ttl });

  // Remove from user's token list
  const remaining = tokens.filter((t) => t.id !== tokenId);
  await env.AUTH_KV.put(kvKey, JSON.stringify(remaining));

  // Clear cache
  tokenCache.delete(tokenId);
}

/**
 * List user's PATs (for Account page)
 */
export async function listMcpTokens(
  env: Bindings,
  userId: string
): Promise<PatMetadata[]> {
  const kvKey = `pat:user:${userId}`;
  return (await env.AUTH_KV.get(kvKey, 'json')) as PatMetadata[] || [];
}
```

**API Endpoints**:

**File**: `src/api/mcp-tokens.ts` (new file)

```typescript
import { Hono } from 'hono';
import { authMiddleware, requireTier } from '../middleware/auth';
import { generateMcpToken, listMcpTokens, revokeMcpToken } from '../lib/mcp-tokens';
import { DB } from '../db';

const app = new Hono();

// List user's tokens (from KV)
app.get('/', authMiddleware(), async (c) => {
  const user = c.get('user');
  const tokens = await listMcpTokens(c.env, user.id);

  return c.json({ tokens });
});

// Create new token (JWT-based PAT)
app.post('/', authMiddleware(), requireTier('coherent'), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const db = new DB(c.env.DB);

  if (!body.expires_in_days || ![30, 60, 90, 365].includes(body.expires_in_days)) {
    return c.json({ error: 'expires_in_days must be 30, 60, 90, or 365' }, 400);
  }

  const { token, metadata } = await generateMcpToken(
    c.env,
    db,
    user.id,
    body.name || 'Unnamed Token',
    body.expires_in_days
  );

  return c.json({
    token,     // JWT - shown only once
    metadata   // Token info for display
  });
});

// Revoke token (add to KV blocklist)
app.delete('/:id', authMiddleware(), async (c) => {
  const user = c.get('user');
  const tokenId = c.req.param('id');

  // Get token to check ownership
  const tokens = await listMcpTokens(c.env, user.id);
  const token = tokens.find((t) => t.id === tokenId);

  if (!token && user.access_tier !== 'prime') {
    return c.json({ error: 'Can only revoke your own tokens' }, 403);
  }

  await revokeMcpToken(c.env, user.id, tokenId);

  return c.json({ success: true });
});

export default app;
```

**Client Configuration**:

```json
// Claude Desktop config.json
{
  "mcpServers": {
    "the-great-game": {
      "url": "https://zoku.205.dev/mcp",
      "headers": {
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      }
    }
  }
}
```

**Notes**:
- Token is a JWT (self-contained, no prefix)
- Validation is fast (~0.5ms JWT verify + ~1-2ms KV check on initialize)
- Session caching: revocation checked on `initialize` only, cached 5 min for tool calls
- Client sends same token with every request (standard Bearer auth)

**Note on OAuth Implementation**: OAuth 2.1 is implemented in Phase 4 alongside PAT using the `@cloudflare/workers-oauth-provider` library. See [Method 1: OAuth 2.1](#method-1-oauth-21-with-pkce-primary) above for full implementation details.

---

## Development Environment

### Challenge

Production uses Cloudflare Access (external dependency). Local development can't use CF Access without deploying to a live domain.

### Solution: JWT-Based Development Flow

#### Option 1: Dev JWT (Recommended)

**Generate a development JWT that mimics CF Access:**

**File**: `scripts/generate-dev-jwt.ts` (new file)

```typescript
import * as jose from 'jose';

async function generateDevJWT() {
  // Generate a keypair for development
  const { publicKey, privateKey } = await jose.generateKeyPair('RS256');

  // Create JWT payload matching CF Access format
  const jwt = await new jose.SignJWT({
    email: 'dev@reset.tech',
    sub: 'dev-user-123',
    iss: 'http://localhost:8789',  // Local issuer
    aud: ['dev-audience'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 365,  // 1 year
  })
    .setProtectedHeader({ alg: 'RS256' })
    .sign(privateKey);

  console.log('Development JWT:', jwt);
  console.log('\nAdd to .dev.vars:');
  console.log(`DEV_JWT=${jwt}`);

  // Export public key for verification
  const publicJwk = await jose.exportJWK(publicKey);
  console.log('\nPublic key (for verification):', JSON.stringify(publicJwk));
}

generateDevJWT();
```

**Environment Configuration** (`.dev.vars`):

```bash
# JWT-based development auth (validates full flow)
DEV_JWT=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...

# Fallback: Simple bypass (skips JWT validation)
DEV_AUTH_BYPASS=true
DEV_USER_EMAIL=dev@reset.tech
```

**Middleware Behavior**:

```typescript
// src/middleware/auth.ts (excerpt)

// Development JWT (tests real flow)
if (env.DEV_JWT) {
  const devJwt = c.req.header('cf-access-jwt-assertion') || env.DEV_JWT;

  try {
    // Validate JWT (same code path as production)
    const payload = await validateCloudflareAccessToken(devJwt, env);
    let user = await db.getZokuByEmail(payload.email);

    if (!user) {
      user = await db.createZoku({
        name: 'Dev User',
        email: payload.email,
        type: 'human',
        access_tier: 'prime',
      });
    }

    c.set('user', user);
    return next();
  } catch (error) {
    logger.warn('Dev JWT validation failed, check DEV_JWT', { error: error.message });
    // Fall through to bypass if JWT invalid
  }
}

// Fallback: Simple bypass (no JWT validation)
if (env.DEV_AUTH_BYPASS === 'true' && env.DEV_USER_EMAIL) {
  let user = await db.getZokuByEmail(env.DEV_USER_EMAIL);

  if (!user) {
    user = await db.createZoku({
      name: 'Dev User',
      email: env.DEV_USER_EMAIL,
      type: 'human',
      access_tier: 'prime',
    });
  }

  c.set('user', user);
  return next();
}
```

**Frontend Dev Flow**:

```
1. Run: npm run dev (backend)
2. Run: cd frontend && npm run dev (frontend)
3. Visit: http://localhost:3000
4. Backend validates DEV_JWT (tests real JWT flow)
5. Or falls back to DEV_AUTH_BYPASS if JWT not configured
6. Authenticated as dev@reset.tech (Prime tier)
```

**Benefits**:
- Tests actual JWT validation code path
- Catches JWT parsing/validation bugs early
- No need to stub/mock CF Access APIs
- Can pass different JWTs to test different users

### Testing Different Tiers

Create multiple test users:

```sql
-- seed-dev-users.sql
INSERT INTO zoku (id, name, email, type, access_tier) VALUES
  ('zoku-test-coherent', 'Test Guest', 'guest@test.local', 'human', 'coherent'),
  ('zoku-test-entangled', 'Test Manager', 'manager@test.local', 'human', 'entangled'),
  ('zoku-test-prime', 'Test Admin', 'admin@test.local', 'human', 'prime');
```

Switch between users:

```bash
# .dev.vars
DEV_USER_EMAIL=guest@test.local  # Test as Coherent
```

### Production Safeguard

```typescript
// src/middleware/auth.ts

// CRITICAL: Never allow bypass in production
if (env.DEV_AUTH_BYPASS === 'true') {
  if (!env.ENVIRONMENT || env.ENVIRONMENT === 'production') {
    throw new Error('DEV_AUTH_BYPASS cannot be enabled in production!');
  }
}
```

---

## Migration Strategy

### Fresh Start - No Data Preservation

**Approach**: Clean slate migration - all existing data will be wiped and recreated with auth fields.

**Why**: This is a prototype with no production data. Starting fresh is simpler and cleaner than migrating.

### Migration Steps

#### Step 1: Fresh Database Schema

**File**: `migrations/005_add_authentication.sql` (fresh migration, not ALTER)

```sql
-- Add auth fields to zoku
ALTER TABLE zoku ADD COLUMN access_tier TEXT NOT NULL DEFAULT 'observed'
  CHECK (access_tier IN ('observed', 'coherent', 'entangled', 'prime'));
ALTER TABLE zoku ADD COLUMN email TEXT UNIQUE;
ALTER TABLE zoku ADD COLUMN cf_access_sub TEXT;
ALTER TABLE zoku ADD COLUMN last_login INTEGER;
ALTER TABLE zoku ADD COLUMN created_by TEXT;
ALTER TABLE zoku ADD COLUMN updated_by TEXT;

CREATE INDEX IF NOT EXISTS idx_zoku_email ON zoku(email);
CREATE INDEX IF NOT EXISTS idx_zoku_cf_sub ON zoku(cf_access_sub);
CREATE INDEX IF NOT EXISTS idx_zoku_access_tier ON zoku(access_tier);

-- Add owner to jewels
ALTER TABLE jewels ADD COLUMN owner_id TEXT REFERENCES zoku(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_jewels_owner ON jewels(owner_id);

-- NOTE: Do NOT create mcp_tokens table - we use KV storage for all MCP auth (both OAuth and PAT)
-- PAT tokens are self-contained JWTs (validated by signature)
-- OAuth tokens are managed by library in KV
-- Revocation uses KV blocklist with TTL

-- Create audit log
CREATE TABLE IF NOT EXISTS audit_log (
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

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_zoku ON audit_log(zoku_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);
```

Run migration:

```bash
# Local - Wipes existing data and recreates with auth
npm run db:reset  # Runs migrations + seed from scratch

# Production - Fresh deployment (first time)
npm run db:migrate:remote
```

**Note**: No data backfill needed - starting fresh!

#### Step 2: Seed Initial Admin User

```sql
-- Create first admin user (will auto-promote on CF Access login)
-- This happens automatically when admin@reset.tech logs in for first time
-- They start as Coherent, admin promotes them to Prime via UI
```

**Alternative**: Bootstrap admin directly in seed:

```sql
-- seed.sql addition
INSERT INTO zoku (id, name, email, type, access_tier, created_at)
VALUES ('zoku-admin-1', 'System Admin', 'admin@reset.tech', 'human', 'prime', unixepoch());
```

#### Step 3: Deploy Code Changes

```bash
# Deploy backend with auth middleware
npm run deploy

# Deploy frontend with auth context
cd frontend && npm run build
```

#### Step 4: Configure Cloudflare Access

1. Create Access Application at https://one.dash.cloudflare.com
2. Configure policies (allow @reset.tech emails)
3. Note AUD tag
4. Set production secrets:

```bash
wrangler secret put CF_ACCESS_TEAM_DOMAIN
wrangler secret put CF_ACCESS_AUD
wrangler secret put JWT_SECRET
```

### Rollback Plan

**Simple**: If critical issues arise, we can redeploy previous version and wipe the database again.

Since this is a prototype with no production data, rollback is straightforward:
1. Revert code to previous commit
2. Run `npm run db:reset` to restore pre-auth schema
3. Redeploy

**No complex data migration rollback needed.**

---

## Implementation Phases

### Phase 1: Foundation (3-4 days)

**Goal**: Database schema and auth libraries (no enforcement yet)

**Tasks**:
- [ ] Add `jose` dependency for JWT validation
- [ ] Create database migration `005_add_authentication.sql` with auth fields
- [ ] Run `npm run db:reset` locally (wipes data, applies new schema)
- [ ] Optionally seed admin user in `seed.sql` or let auto-create on first login
- [ ] Create `src/lib/cf-access.ts` (JWT validation)
- [ ] Create `src/lib/mcp-tokens.ts` (PAT generation/validation)
- [ ] Create `src/middleware/auth.ts` (auth middleware - not applied yet)
- [ ] Add DB methods: `getZokuByEmail`, `updateZokuTier`, `createAuditLog`, etc.
- [ ] Update `src/types.ts` with new interfaces (Zoku with auth fields, AuditLog)

**Testing**:
- Unit tests for JWT validation (mock CF responses)
- Unit tests for PAT generation/validation
- Verify dev bypass works locally

**Timeline**: 3-4 days

### Phase 2: API Authentication (4-5 days)

**Goal**: Protect all API endpoints, enforce permissions

**Tasks**:
- [ ] Apply `authMiddleware()` to all `/api/*` routes in `src/index.ts`
- [ ] Add `requireTier()` to write endpoints (entanglements, sources, qupts)
- [ ] Update `src/api/jewels.ts` for ownership checks and `owner_id` auto-assignment
- [ ] Update `src/api/sources.ts` for jewel ownership validation
- [ ] Create `src/api/zoku.ts` `/me` endpoint (get current user)
- [ ] Create `src/api/zoku.ts` POST endpoint (Entangled creates as observed, Prime sets tier)
- [ ] Create `src/api/zoku.ts` PATCH `/:id/tier` endpoint (Prime only)
- [ ] Create `src/api/mcp-tokens.ts` (PAT CRUD endpoints)
- [ ] Add audit logging to tier changes and jewel operations
- [ ] Update all API routes to log `user_id`

**Testing**:
- Test dev bypass with different `DEV_USER_EMAIL` values
- Verify Coherent: read-only, can't create/edit/delete
- Verify Entangled: full CRUD, creates Zoku as observed only
- Verify Prime: all access including tier management
- Test jewel ownership filtering (can't see others' encrypted data)
- Test audit log entries for sensitive operations

**Timeline**: 4-5 days

### Phase 3: Frontend Integration (3-4 days)

**Goal**: User context, account page, permission-based UI

**Tasks**:
- [ ] Create `frontend/src/lib/auth.tsx` (AuthProvider, useAuth hook)
- [ ] Wrap App in AuthProvider, add `/api/zoku/me` call
- [ ] Create `frontend/src/components/AccountPage.tsx` with user info and PAT management
- [ ] Add MCP token generation UI (name, expiration dropdown, show-once token)
- [ ] Create `frontend/src/components/AccessDenied.tsx` (for observed tier)
- [ ] Update all components to check `user.access_tier` (hide buttons for Coherent)
- [ ] Add user menu with name, email, tier badge, Account link

**Testing**:
- Test as Coherent: verify read-only UI
- Test as Entangled: verify full CRUD UI
- Test PAT generation and revocation
- Verify MCP config instructions display correctly

**Timeline**: 3-4 days

### Phase 4: MCP Authentication - OAuth + PAT (5-6 days)

**Goal**: Secure MCP endpoint with both OAuth 2.1 and PAT support

**Tasks - OAuth Implementation** (using `@cloudflare/workers-oauth-provider`):
- [ ] Install `@cloudflare/workers-oauth-provider` dependency
- [ ] Create KV namespace for OAuth tokens (`OAUTH_KV`)
- [ ] Create `src/lib/oauth-setup.ts` (configure library)
- [ ] Create `src/api/mcp-oauth.ts` (authorization UI + library integration) - **Note**: `google-oauth.ts` exists for jewels
- [ ] Implement `/oauth/authorize` GET (authorization page with CF Access auth)
- [ ] Implement `/oauth/authorize` POST (approval handler calling library)
- [ ] Mount library middleware for `.well-known/*`, `/oauth/token`, `/oauth/revoke`
- [ ] Set `APP_URL` environment variable
- [ ] Style OAuth authorization page
- [ ] Test library handles: metadata, PKCE validation, token exchange, refresh rotation

**Tasks - PAT Implementation** (JWT-based with KV storage):
- [ ] Create KV namespace for auth data (`AUTH_KV` - shared with OAuth)
- [ ] Add `JWT_SECRET` to Cloudflare secrets (for signing PATs)
- [ ] Create `src/lib/mcp-tokens.ts` (JWT signing, validation, KV storage)
- [ ] Implement `generateMcpToken()` - sign JWT with user_id, tier, expiration
- [ ] Implement `validateMcpToken()` - verify JWT + check KV blocklist with caching
- [ ] Implement `revokeMcpToken()` - add to KV blocklist with TTL
- [ ] Implement `listMcpTokens()` - read from KV per-user token list
- [ ] Create `src/api/mcp-tokens.ts` (PAT CRUD endpoints using KV)
- [ ] Update Account Page UI to show OAuth first, PAT second
- [ ] Add token name and expiration dropdown (30, 60, 90, 365 days) to PAT generation

**Tasks - MCP Middleware** (session-aware with caching):
- [ ] Update `validateMcpToken` to support both OAuth (KV) and PAT (JWT)
- [ ] Implement session-aware caching (in-memory Map with 5-min TTL)
- [ ] Update `mcpAuthMiddleware` to detect `initialize` method from JSON-RPC body
- [ ] Pass `isInitialize` flag to `validateMcpToken` for cache control
- [ ] Apply `mcpAuthMiddleware` to `/mcp` endpoint
- [ ] Update MCP tools to check user tier
- [ ] Return permission errors for insufficient tier
- [ ] Mount MCP OAuth routes in `src/index.ts` at `/mcp-oauth` prefix

**Testing - OAuth Flow**:
- Test OAuth discovery endpoints return correct metadata
- Test authorization page requires CF Access JWT
- Test PKCE validation (valid and invalid verifiers)
- Test auth code exchange for tokens
- Test access token expiration and refresh
- Test refresh token rotation
- Test token revocation
- Test Claude Desktop OAuth flow end-to-end

**Testing - PAT Flow**:
- Test PAT generation with all expiration options (30, 60, 90, 365 days)
- Test PAT is a valid JWT with correct claims (sub, jti, tier, exp)
- Test PAT with valid token succeeds
- Test PAT with expired token fails
- Test PAT with revoked token fails (in KV blocklist)
- Test revoked token is cached (fails immediately without KV check)

**Testing - Session-Aware Caching**:
- Test `initialize` request checks KV for revocation (~2-3ms)
- Test subsequent `tools/list` request uses cache (< 1ms, no KV check)
- Test subsequent `tools/call` requests use cache (< 1ms, no KV check)
- Test cache expires after 5 minutes (next request checks KV)
- Test revoked token during session fails after cache expires
- Test multiple concurrent sessions with same token (cache shared per worker)

**Testing - MCP Tools**:
- Verify Coherent users can only use read-only tools (both OAuth and PAT)
- Verify Entangled users can use all tools
- Verify tier checks work for both auth methods
- Test performance: measure auth overhead on initialize vs tool calls

### Phase 5: Production Deployment (2-3 days)

**Goal**: Deploy to production with Cloudflare Access

**Tasks**:
- [ ] Create CF Access application for zoku.205.dev
- [ ] Configure access policies (allow @reset.tech or specific emails)
- [ ] Set production secrets: `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `JWT_SECRET`
- [ ] Create KV namespaces in production
- [ ] Remove `DEV_AUTH_BYPASS` from `wrangler.toml` (keep in `.dev.vars` only)
- [ ] Run `npm run db:reset` on production (wipes existing data)
- [ ] Deploy backend: `npm run deploy`
- [ ] Deploy frontend: `cd frontend && npm run build` (already in worker assets)
- [ ] Test end-to-end: CF Access login → API access → MCP OAuth/PAT

**Testing**:
- Test CF Access login redirects correctly
- Test first user auto-creates as Coherent
- Test admin can promote self to Prime via Account page
- Test MCP OAuth flow from Claude Desktop
- Monitor logs for auth errors

**Timeline**: 2-3 days

### Phase 6: Admin UI & Polish (Optional - 2-3 days)

**Goal**: Admin features for user management

**Tasks**:
- [ ] Add user management UI to Account page (Prime tier only)
  - List all users with tier, email, last login
  - Promote/demote tier buttons
- [ ] Add audit log viewer (simple table, filter by action/user)
- [ ] Polish error messages and loading states
- [ ] Add user onboarding guide (simple markdown doc)

**Testing**:
- Test tier promotion from UI
- Test audit log displays correctly
- Test error messages are helpful

**Timeline**: 2-3 days (optional - can be done post-launch)

---

## Summary: Realistic Timeline

**Total**: 3-4 weeks for MVP authentication

- **Phase 1** (Foundation): 3-4 days
- **Phase 2** (API Auth): 4-5 days
- **Phase 3** (Frontend): 3-4 days
- **Phase 4** (MCP Auth): 5-6 days
- **Phase 5** (Deploy): 2-3 days
- **Phase 6** (Polish): 2-3 days (optional)

**Total**: ~20-25 days = 3-4 weeks

---

## Security Considerations

### Threat Model

| Threat | Mitigation |
|--------|-----------|
| **JWT replay attack** | Short expiration (24h), signature validation, audience check |
| **Token theft** | HTTPS only, HTTP-only cookies for CF Access, secure token storage |
| **Privilege escalation** | Tier checks in middleware + API layer, audit logging |
| **Credential exposure** | Jewels encrypted at rest, filtered by ownership, audit log |
| **CSRF** | SameSite cookies, CF Access handles CSRF |
| **XSS** | React escapes by default, no dangerouslySetInnerHTML |
| **SQL injection** | Prepared statements in D1, parameterized queries |
| **Brute force PAT** | Rate limiting (future), token revocation, expiration |

### Secrets Management

**Environment Variables**:

| Variable | Local (`.dev.vars`) | Production (secrets) |
|----------|---------------------|---------------------|
| `APP_URL` | ✅ `http://localhost:8789` | ✅ `https://zoku.205.dev` |
| `ENCRYPTION_KEY` | ✅ | ✅ (already exists) |
| `JWT_SECRET` | ✅ | ✅ (new) |
| `CF_ACCESS_TEAM_DOMAIN` | ✅ | ✅ (new) |
| `CF_ACCESS_AUD` | ✅ | ✅ (new) |
| `DEV_AUTH_BYPASS` | ✅ | ❌ (NEVER) |
| `DEV_USER_EMAIL` | ✅ | ❌ (NEVER) |
| `DEV_JWT` | ✅ (optional) | ❌ (NEVER) |

**Secret Rotation**:
- `JWT_SECRET`: Rotate annually, invalidates all MCP tokens
- `ENCRYPTION_KEY`: Rotate never (would break all jewels), or migrate with re-encryption
- `CF_ACCESS_AUD`: Changes only if CF Access app is recreated

### Audit Logging

**What to Log**:
- User creation (auto-registration)
- Tier changes (promotion/demotion)
- Jewel creation/deletion
- Source creation/deletion
- MCP token generation/revocation
- Failed authentication attempts (rate limit trigger)
- Permission denied errors (403s)

**Retention**: 10 days default, configurable by admins in Account Page (Prime tier only)

**Query Examples**:

```sql
-- Who promoted user X?
SELECT * FROM audit_log
WHERE resource_type = 'user'
  AND resource_id = 'zoku-123'
  AND action = 'promote';

-- What did user Y delete today?
SELECT * FROM audit_log
WHERE zoku_id = 'zoku-456'
  AND action = 'delete'
  AND timestamp > unixepoch('now', '-1 day');

-- All failed permission checks
SELECT zoku_id, action, resource_type, COUNT(*)
FROM audit_log
WHERE details LIKE '%403%'
GROUP BY zoku_id, action, resource_type;
```

---

## Testing Strategy

### Unit Tests

**Files to Test**:
- `src/lib/cf-access.ts` - JWT validation with mocked JWKS
- `src/lib/mcp-tokens.ts` - Token generation, validation, expiration
- `src/middleware/auth.ts` - Dev bypass, tier checks, error handling

**Test Cases**:
```typescript
// cf-access.ts
- Valid JWT with correct aud/iss → success
- Expired JWT → error
- Wrong audience → error
- Invalid signature → error
- Missing email claim → error

// mcp-tokens.ts
- Generate token → correct format (zgpat_...)
- Validate valid token → returns user
- Validate expired token → error
- Validate revoked token → error
- Hash collision → error

// auth.ts (middleware)
- Dev bypass enabled + email set → mock user
- Dev bypass disabled + no JWT → 401
- Valid JWT + new user → creates Coherent user
- Valid JWT + existing user → loads user
- User tier=observed → 403
- requireTier('entangled') with Coherent user → 403
```

### Integration Tests

**API Endpoint Tests**:

```bash
# Test script: tests/auth-integration.sh

# Test 1: Unauthenticated request → 401
curl -X GET https://zoku.205.dev/api/entanglements
# Expected: 401 Unauthorized

# Test 2: Valid CF Access JWT → 200
curl -X GET https://zoku.205.dev/api/entanglements \
  -H "cf-access-jwt-assertion: $VALID_JWT"
# Expected: 200 OK

# Test 3: Coherent user tries to create → 403
curl -X POST https://zoku.205.dev/api/entanglements \
  -H "cf-access-jwt-assertion: $COHERENT_USER_JWT" \
  -d '{"name": "Test"}'
# Expected: 403 Forbidden

# Test 4: Entangled user creates → 201
curl -X POST https://zoku.205.dev/api/entanglements \
  -H "cf-access-jwt-assertion: $ENTANGLED_USER_JWT" \
  -d '{"name": "Test"}'
# Expected: 201 Created
```

### Manual Testing Checklist

**Frontend**:
- [ ] Visit prod URL without auth → redirected to CF Access
- [ ] Authenticate via email OTP → redirected to app
- [ ] New user sees Coherent tier badge
- [ ] Coherent user cannot see create buttons
- [ ] Admin promotes user to Entangled → buttons appear
- [ ] User generates MCP token → shown once
- [ ] User copies token → not shown again
- [ ] User revokes token → disappears from list

**MCP**:
- [ ] Claude Desktop with no token → 401 error
- [ ] Claude Desktop with valid token → tools work
- [ ] Coherent user uses list tools → success
- [ ] Coherent user uses create tools → 403 error
- [ ] Entangled user uses all tools → success
- [ ] Revoke token in UI → Claude can no longer use it

**Jewels**:
- [ ] User creates jewel → owned by user
- [ ] User sees own jewel (full data) → success
- [ ] User sees others' jewel → metadata only
- [ ] User tries to delete others' jewel → 403
- [ ] Admin deletes others' jewel → success

---

## Appendices

### Appendix A: File Changes Summary

| File | Action | Priority |
|------|--------|----------|
| `package.json` | Add `jose` dependency | P0 |
| `migrations/004_add_authentication.sql` | New migration | P0 |
| `src/types.ts` | Add auth interfaces | P0 |
| `src/lib/cf-access.ts` | New file - JWT validation | P0 |
| `src/lib/mcp-tokens.ts` | New file - PAT handling | P0 |
| `src/middleware/auth.ts` | New file - auth middleware | P0 |
| `src/db.ts` | Add auth-related methods | P0 |
| `src/index.ts` | Apply middleware to routes | P1 |
| `src/api/entanglements.ts` | Add tier checks, owner tracking | P1 |
| `src/api/zoku.ts` | Add `/me` endpoint, tier checks | P1 |
| `src/api/jewels.ts` | Add owner checks, filtering | P1 |
| `src/api/sources.ts` | Add jewel owner validation | P1 |
| `src/api/qupts.ts` | Add user tracking | P1 |
| `src/api/mcp-tokens.ts` | New file - PAT management API | P1 |
| `src/mcp/server.ts` | Add MCP auth middleware | P2 |
| `frontend/src/lib/api.ts` | Add getCurrentUser method | P1 |
| `frontend/src/lib/auth.tsx` | New file - auth context | P1 |
| `frontend/src/components/AccountPage.tsx` | New file - MCP tokens | P2 |
| `frontend/src/components/AccessDenied.tsx` | New file - 403 page | P2 |
| `frontend/src/components/Dashboard.tsx` | Add tier-based UI | P2 |
| `frontend/src/App.tsx` | Wrap in AuthProvider | P1 |
| `wrangler.toml` | Update with new vars (not secrets) | P0 |
| `.dev.vars` | Add dev auth bypass vars | P0 |
| `README.md` | Update with auth setup instructions | P2 |

### Appendix B: New Database Methods Required

**File**: `src/db.ts`

```typescript
// Zoku methods
async getZokuByEmail(email: string): Promise<Zoku | null>
async getZokuByCfSub(cf_sub: string): Promise<Zoku | null>
async updateZokuTier(id: string, tier: AccessTier): Promise<void>

// MCP token methods
async createMcpToken(data: CreateMcpTokenInput): Promise<McpToken>
async getMcpToken(id: string): Promise<McpToken | null>
async getMcpTokenByHash(hash: string): Promise<McpToken | null>
async listMcpTokens(zoku_id: string): Promise<McpToken[]>
async revokeMcpToken(id: string): Promise<void>
async updateMcpToken(id: string, data: Partial<McpToken>): Promise<void>

// Audit log methods
async createAuditLog(data: CreateAuditLogInput): Promise<AuditLog>
async listAuditLogs(filters: AuditLogFilters): Promise<AuditLog[]>
```

### Appendix C: Environment Variables Reference

| Variable | Type | Required | Example | Description |
|----------|------|----------|---------|-------------|
| `APP_URL` | Var | ✅ | `https://zoku.205.dev` | Canonical application URL |
| `ENCRYPTION_KEY` | Secret | ✅ | `(32-byte hex)` | AES-GCM key for jewels |
| `JWT_SECRET` | Secret | ✅ | `(32-byte random)` | MCP token signing key |
| `CF_ACCESS_TEAM_DOMAIN` | Secret | ✅ | `https://team.cloudflareaccess.com` | CF Access team URL |
| `CF_ACCESS_AUD` | Secret | ✅ | `abc123...` | CF Access application AUD tag |
| `LOG_LEVEL` | Var | ❌ | `info` | Logging verbosity |
| `DEV_AUTH_BYPASS` | Dev only | ❌ | `true` | Skip auth in dev |
| `DEV_USER_EMAIL` | Dev only | ❌ | `dev@reset.tech` | Dev user email |
| `DEV_USER_TIER` | Dev only | ❌ | `prime` | Dev user tier |
| `DEV_JWT` | Dev only | ❌ | `eyJhbGc...` | Dev JWT for testing real flow |

### Appendix D: MCP Client Configuration Examples

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "the-great-game": {
      "url": "https://zoku.205.dev/mcp",
      "headers": {
        "Authorization": "Bearer zgpat_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

**Cline** (VS Code extension):

```json
{
  "mcp": {
    "servers": [
      {
        "name": "The Great Game",
        "url": "https://zoku.205.dev/mcp",
        "auth": {
          "type": "bearer",
          "token": "zgpat_YOUR_TOKEN_HERE"
        }
      }
    ]
  }
}
```

---

## Design Decisions - Confirmed

All key decisions have been confirmed:

### 1. **Access Tier Defaults** ✅ CONFIRMED

**Decision**: Smart auto-promotion based on context

**Implementation**:
- Managers create Zoku for PASCI matrix → `observed` tier (most never visit the system)
- User authenticates via CF Access:
  - **If existing** as `observed` → auto-promote to `coherent` (read-only)
  - **If not in database** → auto-create as `coherent` (read-only)

**Rationale**: This handles two use cases: (1) pre-created team members who later gain access, and (2) new users discovering the system. Both start with safe read-only access.

### 2. **Jewel Migration** ✅ CONFIRMED

**Decision**: No migration needed - no existing jewels in production

### 3. **MCP Token Expiration** ✅ CONFIRMED

**Decision**: User choice required - 30, 60, 90, or 365 days maximum

**Implementation**: Dropdown in PAT generation UI with options:
- 30 days
- 60 days
- 90 days (default/recommended)
- 365 days (maximum)

**Rationale**: No "never expires" option reduces security risk. Users can regenerate tokens as needed.

### 4. **OAuth 2.1 Priority** ✅ CONFIRMED

**Decision**: Implement **both OAuth and PAT together** in Phase 4

**Rationale**:
- OAuth is the primary/default method (better UX, automatic, short-lived tokens)
- PAT is the fallback for legacy clients and automation
- Modern MCP clients expect OAuth support
- Building both together ensures comprehensive auth coverage

### 5. **Development Flow** ✅ CONFIRMED

**Decision**: JWT-based dev flow with actual CF Access validation

**Implementation**:
- Generate admin JWT token for development
- Pass via same `cf-access-jwt-assertion` header locally
- Validates full auth flow including JWT signature verification
- Optionally: fallback to simple bypass mode if JWT not provided

**Rationale**: Tests the real authentication path, catches JWT validation bugs early.

### 6. **Audit Log Retention** ✅ CONFIRMED

**Decision**: 10 days default, configurable by admins

**Implementation**:
- Default retention: 10 days
- Admin setting in Account Page (Prime tier only)
- Automatic cleanup via scheduled worker
- Admin can view/export logs before deletion

**Rationale**: Short retention minimizes storage costs while maintaining recent audit trail. Admins can adjust based on compliance needs.

### 7. **Rate Limiting** ✅ CONFIRMED

**Decision**: Not in MVP, defer to future phase

**Rationale**: Add complexity without clear need. Can add later if abuse patterns emerge. Cloudflare provides DDoS protection at edge.

---

**Implementation Status**: Ready to proceed

This plan is approved and ready for implementation. All ambiguities have been resolved and design decisions are locked in.
