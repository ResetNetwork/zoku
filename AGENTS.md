# The Great Game - AI Agent Context

## Project Overview
The Great Game is a project/initiative tracking system inspired by the Quantum Thief trilogy. Built as a Cloudflare Worker with D1 database, MCP interface, and web frontend.

## Current Status: ✅ Full-Stack Application Complete + Authentication

### Completed Phases (0-6)
- **Phase 0**: Infrastructure setup (GitHub, D1, encryption)
- **Phase 1**: Dependencies and database schema
- **Phase 2**: Full REST API with CRUD operations
- **Phase 3**: Source handlers (GitHub, Zammad, Google Drive)
- **Phase 4**: MCP Server with 29 tools (includes jewel store)
- **Phase 5**: React frontend with light/dark mode
- **Phase 5.5**: Source & Jewel Management + Google OAuth
- **Phase 5.6**: Comprehensive Structured Logging
- **Phase 5.7**: Complete Authentication System ✅ NEW
  - OAuth 2.1 for MCP (RFC 8414 compliant, PKCE, dynamic registration)
  - Personal Access Tokens (PAT) with revocation
  - Four-tier permissions (observed, coherent, entangled, prime)
  - Session management (track and revoke OAuth sessions)
  - Cloudflare Access integration for web UI
  - Dev mode (skip JWT validation for local testing)

### Remaining Phases
- **Phase 6**: Production deployment to zoku.205.dev (pending Cloudflare Access setup)

## Architecture

### Core Concepts
- **Entanglement**: A project/initiative (can be nested)
- **Zoku**: Partner/entity (human or AI agent)
- **Qupt**: Activity record from any source
- **PASCI Matrix**: Responsibility assignment (Perform, Accountable, Control, Support, Informed)
- **Dimensions**: Taxonomy system (status, function, pillar, service_area)
- **Sources**: External activity collectors (GitHub, Zammad, Google Docs)

### Tech Stack
- **Backend**: Cloudflare Worker (Hono framework)
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: React + Vite + Tailwind + TanStack Query
- **MCP**: Official @modelcontextprotocol/sdk
- **Cron**: 5-minute scheduled source collection
- **Domain**: zoku.205.dev

### Service Layer Architecture ✅ NEW
**Complete refactor to shared business logic** (December 2025)

```
┌─────────────────────────────────────────────────────┐
│                    Clients                           │
├──────────────────────┬──────────────────────────────┤
│   Web UI (React)     │   Claude Desktop (MCP)       │
└──────────┬───────────┴────────────┬─────────────────┘
           │                        │
           │ HTTP/JSON              │ MCP Protocol
           │                        │
           ▼                        ▼
    ┌──────────────┐        ┌──────────────┐
    │  REST Routes │        │  MCP Tools   │
    │  (thin)      │        │  (thin)      │
    │  ~600 lines  │        │  ~660 lines  │
    └──────┬───────┘        └──────┬───────┘
           │                        │
           └────────┬───────────────┘
                    ▼
         ┌─────────────────────┐
         │   SERVICE LAYER     │ ← SINGLE SOURCE OF TRUTH
         │   ~1200 lines       │
         │                     │
         │  - Validation       │ (using Zod schemas)
         │  - Authorization    │ (tier checks)
         │  - Business logic   │ (all rules here)
         │  - Audit logging    │ (automatic)
         │  - DB operations    │ (transactions)
         └──────────┬──────────┘
                    ▼
            ┌──────────────┐
            │   Database   │
            └──────────────┘
```

**Key Benefits:**
- ✅ **Single validation path** - All input validation in services using Zod
- ✅ **Zero duplication** - Business logic written once, used by both REST and MCP
- ✅ **Testable** - Can test services without HTTP/MCP concerns
- ✅ **Consistent** - Same tier checks, error handling, audit logging everywhere
- ✅ **Maintainable** - Update logic once, both endpoints benefit

**Code Reduction:**
- REST API: 2400 lines → 600 lines (75% reduction)
- MCP Tools: 1604 lines → 658 lines (59% reduction)
- Total: 4000 lines → 2458 lines (39% reduction)
- Added: Services layer ~1200 lines (single source of truth)

**Services:**
- `BaseService` - Common validation, authorization, audit logging
- `EntanglementService` - 13 methods (list, get, create, update, delete, matrix ops, attributes)
- `ZokuService` - 6 methods (list, get, create, update, delete, updateTier)
- `QuptService` - 5 methods (list, get, create, batchCreate, delete)
- `JewelService` - 6 methods (list, get, create, update, delete, getUsage)
- `SourceService` - 5 methods (get, create, update, delete, sync)

See `docs/SHARED_SERVICE_LAYER_PLAN.md` for complete details.

## MCP Tools Available (29)

### Entanglements
- `list_entanglements` - List projects with filters
- `get_entanglement` - Get full details including children and qupts
- `get_children` - Get child entanglements (recursive option)
- `create_entanglement` - Create new project
- `update_entanglement` - Update name, description, parent
- `move_entanglement` - Change parent/make root
- `delete_entanglement` - Delete (requires confirmation)

### Activity (Qupts)
- `create_qupt` - Record activity manually
- `list_qupts` - List activity (recursive aggregation from children)

### Zoku Entities
- `list_zoku` - List all partners
- `create_zoku` - Register new partner
- `get_zoku` - Get details with entanglements

### PASCI Matrix
- `entangle` - Assign entity to role
- `disentangle` - Remove from role
- `get_matrix` - View full responsibility matrix

### Taxonomy
- `list_dimensions` - Get all dimensions and values
- `set_attributes` - Set entanglement attributes
- `get_attributes` - Get entanglement attributes

### Sources
- `list_sources` - List configured sources
- `add_source` - Add GitHub/Zammad/Google Docs source (supports jewel_id)
- `sync_source` - Trigger manual sync (fully implemented)
- `remove_source` - Delete source
- `toggle_source` - Enable/disable source

### Jewels (NEW)
- `add_jewel` - Store and validate jewels for reuse
- `list_jewels` - View stored jewels (encrypted data hidden)
- `get_jewel` - Get jewel details
- `update_jewel` - Rotate/update jewels
- `delete_jewel` - Remove jewel (blocks if in use)
- `get_jewel_usage` - See which sources use a jewel

## Key Files

### Backend - Services Layer ✅ NEW
- `src/services/base.ts` - Base service class (validation, authorization, audit)
- `src/services/entanglements.ts` - Entanglement business logic (13 methods)
- `src/services/zoku.ts` - Zoku business logic (6 methods)
- `src/services/qupts.ts` - Qupt business logic (5 methods)
- `src/services/jewels.ts` - Jewel business logic (6 methods)
- `src/services/sources.ts` - Source business logic (5 methods)
- `src/lib/validation.ts` - Zod validation schemas
- `src/lib/errors.ts` - Error classes and global error handler

### Backend - Core
- `src/index.ts` - Worker entry point, route mounting
- `src/db.ts` - Database query helpers (DB class)
- `src/types.ts` - TypeScript type definitions
- `src/scheduled.ts` - Cron handler for source collection
- `src/mcp/server.ts` - MCP server (29 tools using services) ✅ REFACTORED
- `src/mcp/mcp-helpers.ts` - Service factory and tool wrapper ✅ NEW
- `src/lib/logger.ts` - Structured logging class
- `src/middleware/logging.ts` - Hono logging middleware
- `src/middleware/auth.ts` - Authentication middleware (CF Access + dev JWT)
- `src/lib/cf-access.ts` - Cloudflare Access JWT validation
- `src/lib/mcp-oauth.ts` - OAuth 2.1 server implementation
- `src/lib/mcp-tokens.ts` - PAT generation and validation

### Frontend
- `frontend/src/App.tsx` - Main app with URL routing and view management
- `frontend/src/components/Dashboard.tsx` - Home with clickable metrics, top 5 entanglements, recent activity
- `frontend/src/components/EntanglementsList.tsx` - All entanglements with stats
- `frontend/src/components/EntanglementDetail.tsx` - Individual entanglement with responsibilities, sources, activity
- `frontend/src/components/ZokuList.tsx` - All zoku with PASCI responsibility matrix
- `frontend/src/components/ZokuDetail.tsx` - Individual zoku with editable metadata
- `frontend/src/components/ActivityList.tsx` - All activity across entanglements
- `frontend/src/components/SourcesList.tsx` - All configured sources
- `frontend/src/components/QuptItem.tsx` - Expandable activity items with type-specific formatting
- `frontend/src/components/AccountPage.tsx` - User profile, OAuth sessions, PAT management ✅ NEW
- `frontend/src/components/AccessDenied.tsx` - Access denied page (observed tier) ✅ NEW
- `frontend/src/lib/api.ts` - API client with TypeScript types
- `frontend/src/lib/auth.tsx` - Auth context, hooks (useAuth, useCanWrite, useIsPrime) ✅ NEW
- `frontend/src/lib/theme.ts` - Theme management (light/dark mode)
- `frontend/src/lib/notifications.tsx` - Toast notification system

### API Routes (Thin wrappers around services) ✅ REFACTORED
- `src/api/entanglements.ts` - Entanglement endpoints (uses EntanglementService)
- `src/api/zoku.ts` - Zoku endpoints (uses ZokuService)
- `src/api/qupts.ts` - Qupt endpoints (uses QuptService)
- `src/api/sources.ts` - Source endpoints (uses SourceService)
- `src/api/jewels.ts` - Jewel endpoints (uses JewelService)
- `src/api/dimensions.ts` - Taxonomy read-only (no service needed)
- `src/api/mcp-oauth.ts` - OAuth 2.1 endpoints + authorization UI
- `src/api/mcp-tokens.ts` - PAT management API
- `src/api/google-oauth.ts` - Google OAuth for jewels (separate from MCP auth)

### Source Handlers
- `src/handlers/index.ts` - Handler registry
- `src/handlers/github.ts` - GitHub Events API
- `src/handlers/zammad.ts` - Zammad tickets + articles
- `src/handlers/gdocs.ts` - Google Docs revisions
- `src/handlers/google-auth.ts` - OAuth token refresh
- `src/handlers/validate.ts` - Jewel validation (NEW)

### Database
- `schema.sql` - Full schema with all tables including auth fields
- `seed.sql` - Initial taxonomy data
- `migrations/002_add_jewels.sql` - Jewel store migration
- `migrations/003_add_zoku_description.sql` - Zoku description field
- `migrations/004_add_source_error_tracking.sql` - Source error tracking
- `migrations/005_add_authentication.sql` - Authentication system ✅ NEW

## Authentication

### Overview
Four-tier access control (observed, coherent, entangled, prime) with dual MCP authentication:
- **OAuth 2.1** (primary): Automatic browser-based flow for modern MCP clients
- **PAT** (fallback): Manual tokens for scripts and legacy clients

See [docs/authentication.md](docs/authentication.md) for complete documentation.

### Quick Start (Local Dev)

**1. Generate dev JWT for web UI:**
```bash
node scripts/generate-dev-jwt.js dev@reset.tech
```

**2. Add to browser (ModHeader extension):**
```
Header: cf-access-jwt-assertion
Value: <generated-jwt>
```

**3. Configure MCP client (OAuth):**
```json
{
  "mcpServers": {
    "zoku_local": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

Client auto-discovers OAuth, opens browser to authorize.

**4. Or use PAT (fallback):**
- Generate from Account page
- Add to MCP config: `"headers": {"Authorization": "Bearer <token>"}`

### Access Tiers

- **observed**: No access (pre-created for PASCI)
- **coherent**: Read-only + jewel management (default for new users)
- **entangled**: Full CRUD operations (team members)
- **prime**: Admin access + user management (system admins)

## Development Commands

```bash
# Backend dev server
npm run dev              # Starts on :8789 (fixed port)

# Frontend dev server
cd frontend && npm run dev  # Starts on :3000

# Database operations
npm run db:migrate        # Local migration
npm run db:seed          # Local seed
npm run db:reset         # Migrate + seed
npm run db:migrate:remote # Production migration
npm run db:seed:remote   # Production seed

# Deployment
npm run deploy           # Deploy to Cloudflare

# Logs (production)
wrangler tail            # Stream live logs from production
wrangler tail --format pretty | grep '"level":"error"'  # Filter errors only
```

## Frontend Features

- **Dashboard View**:
  - Clickable metrics for navigation (7 entanglements, 13 zoku, activity, sources)
  - Top 5 entanglements sorted by recent activity
  - Recent 10 qupts with entanglement badges
  - "View all" links to dedicated pages
  - Sync all sources button

- **Entanglement Pages**:
  - All Entanglements: Complete list with stats
  - Entanglement Detail: Responsibilities, sources, activity stream
  - Shows zoku, qupts, and sources counts

- **Zoku Pages**:
  - All Zoku: List with stats and PASCI responsibility matrix
  - Zoku Detail: Metadata fields, assigned entanglements with roles
  - Editable fields: description, GitHub username, email, role, org, timezone, deal_id
  - Deal ID links to deals.reset.tech

- **Activity & Sources Pages**:
  - Activity List: All qupts across entanglements with source badges
  - Sources List: All configured sources with sync status

- **Responsibility Matrix** (on Zoku page):
  - Entanglements as rows, PASCI roles as columns
  - Shows first 5, expandable to all
  - Sorted alphabetically
  - Clickable zoku badges

- **Activity Display**:
  - Type-specific icons for different event types
  - GitHub: Commit SHA, branch, PR titles, issue links
  - Zammad: Ticket state, article bodies, type indicators
  - Expandable details on click
  - External link icons for URLs
  - Entanglement badges on cross-entanglement views

- **Theme Support**:
  - Light/dark mode toggle
  - Persistent theme preference
  - Quantum-themed color palette

- **URL Routing**:
  - Direct links to any page or entity
  - Browser back/forward support
  - Shareable URLs

## Logging System

### Overview
Comprehensive structured JSON logging with request correlation, session tracking, and minimal performance overhead. Logs output to console (captured by Cloudflare) and viewable via `wrangler tail`.

### Features
- **Structured JSON logs** with consistent schema
- **Request ID correlation** (8-char UUID) for tracing operations end-to-end
- **Session ID tracking** from frontend (stored in sessionStorage)
- **Duration tracking** for all operations (in milliseconds)
- **Log levels**: info, warn, error, fatal (default: info)
- **Automatic middleware** for all HTTP requests
- **MCP tool logging** with execution timing
- **Source sync logging** with success/failure tracking
- **Error capture** with stack traces

### Log Structure
```json
{
  "timestamp": "2025-12-12T14:06:02.986Z",
  "level": "info",
  "message": "Request completed",
  "request_id": "3ac179a8",
  "session_id": "cb17b1d5-67d9-4464-8019-dc4d0fe788db",
  "operation": "api_request",
  "path": "/api/entanglements",
  "method": "GET",
  "metadata": {
    "status_code": 200,
    "duration_ms": 3,
    "query": {"root_only": "true", "limit": "50"}
  }
}
```

### Log Operations
- `api_request` - HTTP API requests
- `mcp_request` - MCP protocol requests
- `mcp_tool` - MCP tool executions
- `scheduled_sync` - Cron-triggered syncs
- `source_sync` - Individual source synchronization

### Implementation
- **Middleware**: `src/middleware/logging.ts` - Automatic request/response logging
- **Logger Class**: `src/lib/logger.ts` - Core logging functionality with child logger support
- **Frontend Session**: `frontend/src/lib/api.ts` - Session ID generation and propagation
- **Environment**: `LOG_LEVEL` env var controls minimum log level (default: info)

### Viewing Logs
```bash
# Local development - logs appear in console automatically
npm run dev

# Production
wrangler tail                                              # All logs
wrangler tail --format pretty | grep '"level":"error"'   # Errors only
wrangler tail --format pretty | grep '"request_id":"abc"' # Trace specific request
```

### Performance Impact
- Console logging: ~0.1ms per log entry
- Request ID generation: ~0.05ms per request
- No database writes: Zero database overhead
- Total overhead: < 2ms per request

## Source Configuration

Sources can use stored jewels (recommended) or inline jewels. All jewels are encrypted at rest using ENCRYPTION_KEY.

### Jewel Store Workflow (Recommended)
```javascript
// 1. Store jewel once (validates and encrypts)
add_jewel({
  name: "GitHub - Personal",
  type: "github",
  data: { token: "ghp_xxx" }
})
// Returns: { id: "cred-123", validation: { authenticated_as: "username", scopes: [...] } }

// 2. Reuse for multiple sources
add_source({
  entanglement_id: "vol-1",
  type: "github",
  config: { owner: "ResetNetwork", repo: "zoku", events: ["push", "pull_request", "issues"] },
  jewel_id: "cred-123"  // Reference stored jewel
})
```

### Inline Jewels (Legacy)
```json
{
  "type": "github",
  "config": {
    "owner": "ResetNetwork",
    "repo": "zoku",
    "events": ["push", "pull_request", "issues"]
  },
  "jewels": {
    "token": "ghp_xxx"
  }
}
```

### Zammad Example
```javascript
// Using jewel_id (recommended)
add_source({
  entanglement_id: "vol-1",
  type: "zammad",
  config: {
    url: "https://help.reset.tech",
    tag: "zoku",  // REQUIRED - only tickets with this tag
    include_articles: true
  },
  jewel_id: "cred-zammad-123"
})
```

**Note:** The `tag` field is required for Zammad sources. Only tickets tagged with the specified tag will be collected as qupts.

### Google Docs Example
```json
{
  "type": "gdocs",
  "config": {
    "document_id": "1abc123...",
    "track_suggestions": false
  },
  "jewels": {
    "client_id": "xxx",
    "client_secret": "xxx",
    "refresh_token": "xxx"
  }
}
```

## Design Decisions

### No Enforcement, Just Warnings
- Taxonomy dependencies (pillar requires function=tech_innovation) are frontend-filtered, not enforced
- PASCI "Perform" role is recommended but not required
- Only "Accountable" is enforced (exactly one required)

### Error Handling
- Source sync errors: log, continue, retry on next cron
- No source disabling on errors (manual intervention required)

### Nesting
- Unlimited depth for entanglements
- Qupts aggregate from all descendants by default
- Deletion cascades to children

### Deduplication
- Qupts use `external_id` with unique index `(source, external_id)`
- Format: `github:{id}`, `zammad:ticket:{id}:{timestamp}`, `gdocs:{doc_id}:rev:{id}`

## API Endpoints

### Health
- `GET /health` - Health check

### Entanglements
- `GET /api/entanglements` - List (supports filtering)
- `POST /api/entanglements` - Create
- `GET /api/entanglements/:id` - Get details
- `PATCH /api/entanglements/:id` - Update
- `DELETE /api/entanglements/:id` - Delete
- `GET /api/entanglements/:id/matrix` - Get PASCI matrix
- `POST /api/entanglements/:id/matrix` - Assign to matrix
- `DELETE /api/entanglements/:id/matrix/:zoku_id/:role` - Remove from matrix
- `GET /api/entanglements/:id/attributes` - Get attributes
- `PUT /api/entanglements/:id/attributes` - Set attributes (replace all)
- `POST /api/entanglements/:id/attributes` - Add single attribute
- `DELETE /api/entanglements/:id/attributes/:dimension_id` - Remove attributes
- `GET /api/entanglements/:id/sources` - List sources
- `POST /api/entanglements/:id/sources` - Add source

### Zoku
- `GET /api/zoku` - List
- `POST /api/zoku` - Create
- `GET /api/zoku/:id` - Get details
- `PATCH /api/zoku/:id` - Update
- `DELETE /api/zoku/:id` - Delete

### Qupts
- `GET /api/qupts` - List (with filters)
- `POST /api/qupts` - Create
- `POST /api/qupts/batch` - Batch create
- `GET /api/qupts/:id` - Get single
- `DELETE /api/qupts/:id` - Delete

### Sources
- `GET /api/sources/:id` - Get details (no jewels)
- `PATCH /api/sources/:id` - Update
- `DELETE /api/sources/:id` - Delete
- `POST /api/sources/:id/sync` - Manual sync trigger

### Dimensions
- `GET /api/dimensions` - List all with values
- `GET /api/dimensions/:id` - Get single with values

### MCP
- `POST /mcp` - MCP server endpoint (tools/list, tools/call)

### OAuth (MCP Authentication)
- `GET /.well-known/oauth-authorization-server` - RFC 8414 metadata discovery
- `GET /oauth/authorize` - Authorization UI (quantum-themed)
- `POST /oauth/authorize` - User approval handler
- `POST /oauth/token` - Token exchange & refresh
- `POST /oauth/register` - Dynamic client registration (RFC 7591)
- `POST /oauth/revoke` - Token revocation
- `GET /oauth/sessions` - List active OAuth sessions
- `DELETE /oauth/sessions/:id` - Revoke session

### MCP Tokens (PAT)
- `GET /api/mcp-tokens` - List user's tokens
- `POST /api/mcp-tokens` - Generate new token (30/60/90/365 days)
- `DELETE /api/mcp-tokens/:id` - Revoke token

## Next Steps

1. **Phase 6** - Deploy to production at zoku.205.dev
   - Build frontend assets
   - Deploy worker with assets
   - Run production migrations
   - Configure Cloudflare Access
   - Test full stack in production

## Notes for Future AI Agent Sessions

- Wrangler upgraded to v4.53.0 (was v3.114.15)
- node_modules excluded from git via .gitignore
- Local D1 database persists in `.wrangler/state/v3/d1/`
- MCP server is HTTP-based at `/mcp`, not stdio
- All jewels are AES-GCM encrypted using ENCRYPTION_KEY secret
- Scheduled handler runs every 5 minutes via Cloudflare Cron
- **Jewel Store**: 29 MCP tools total (23 original + 6 jewel tools)
- **Local dev**: ENCRYPTION_KEY set in `.dev.vars` (not committed to git)
- **Validation**: GitHub, Zammad, Google Docs jewels validated on add/update
- **Testing**: Successfully tested end-to-end with GitHub (5 qupts) and Zammad (1 qupt)
- **Simplified Responses**: All tools support optional `detailed` parameter for verbose output
- **Zammad**: Tag-based filtering required - `tag` field mandatory in config
- **Response Size**: 60-80% reduction with default (non-detailed) responses
- **Frontend Complete**: Full app with 9 pages (Dashboard, Entanglements, Zoku, Activity, Sources, Jewels, Account, + detail pages)
- **Theme**: Light/dark mode with localStorage persistence
- **Activity Formatting**: Client-side dynamic formatting from metadata for all sources (instant format changes!)
- **Type-specific Icons**: ← commits/edits, 💬 comments, ◆ issues/tickets, ⇄ PRs (consistent across sources)
- **Google OAuth**: Per-jewel OAuth flow with popup, re-authorization, account email display
- **Source Management**: Add/Edit/Delete UI with validation, access checking, error handling
- **Jewel Management**: Full CRUD page for GitHub tokens, Zammad (token+URL), Google Drive OAuth
- **Health Monitoring**: Red/green/gray dots with error messages ("Access denied. Add email@example.com...")
- **Manual Sync**: Fully implemented (was TODO) with error tracking
- **Activity Filtering**: Filter by entanglement and source type
- **Initial Sync**: New sources pull 30 days of history
- **Error Lifecycle**: Detect → Store → Display → Clear on success
- **Dev Setup**: Backend on :8789 (fixed port), frontend on :3000, run in separate terminals
- **Vite Proxy**: Frontend proxies /api, /mcp, /oauth, /.well-known to http://localhost:8789
- **Zoku Metadata**: Description, GitHub username, email, role, org, timezone, deal_id (all editable)
- **Responsibility Matrix**: Entanglements × PASCI roles grid view on Zoku page
- **Navigation**: Clickable metrics, URL routing, direct links to any entity, clickable entanglements in matrix
- **Counts**: All views show zoku_count, qupts_count, sources_count, children_count
- **Example Data**: 15 zoku + 7 entanglements with PASCI assignments
- **Notifications**: Toast system with success/error/info types, auto-dismiss
- **OAuth Callback**: 5-second success message before auto-close
- **OAuth 2.1 MCP Auth**: Complete implementation with PKCE, refresh tokens, session management ✅ NEW
- **PAT System**: JWT-based Personal Access Tokens with revocation ✅ NEW
- **Session Management**: Track and revoke OAuth sessions from Account page ✅ NEW
- **Four-Tier Access**: observed/coherent/entangled/prime with auto-promotion ✅ NEW
- **Dev Auth**: Skip JWT validation in dev, use cf-access-jwt-assertion header ✅ NEW
- **Account Page**: Profile + OAuth sessions + PAT management ✅ NEW
- **Permission UI**: Show/hide based on user tier (useCanWrite, useIsPrime hooks) ✅ NEW
- **Structured Logging**: Comprehensive JSON logs with request/session IDs, duration tracking ✅ NEW
- **Log Middleware**: Automatic logging for all HTTP requests (info/warn/error/fatal levels)
- **Session Tracking**: Frontend generates session IDs, propagates via X-Zoku-Session-ID header
- **Request Correlation**: 8-char request IDs for tracing operations across logs
- **MCP Logging**: Tool execution timing and results logged automatically
- **Source Sync Logging**: Per-source success/failure tracking with error messages
- **Log Levels**: Configurable via LOG_LEVEL env var (default: info, supports: info/warn/error/fatal)
- **Performance**: < 2ms overhead per request, no database writes
- **Viewing Logs**: `wrangler tail` for production, console for local dev
- **Service Layer Refactor**: Complete migration to shared business logic (December 2025) ✅ NEW
- **Code Reduction**: 39% overall (4000→2458 lines), REST 75%, MCP 59%
- **Single Validation**: All validation in services using Zod, zero duplication
- **Testable Architecture**: Business logic separated from HTTP/MCP concerns

## Authentication System

### Overview
Complete four-tier authentication with OAuth 2.1 and PAT support.

**Access Tiers:**
- `observed` (0): No access - pre-created for PASCI matrix
- `coherent` (1): Read-only + jewel management - default for new users
- `entangled` (2): Full CRUD operations - team members
- `prime` (3): Admin access + user management - system admins

**MCP Authentication (Dual Method):**
- **OAuth 2.1** (Primary): Automatic browser-based authorization
  - RFC 8414 metadata discovery
  - Authorization code grant with PKCE (S256)
  - Refresh tokens (30-day TTL)
  - Dynamic client registration (RFC 7591)
  - Session management with revocation
- **PAT** (Fallback): Manual long-lived tokens
  - Generate from Account page (30/60/90/365 days)
  - JWT-based with KV revocation
  - Session-aware caching (5-min TTL)

**Web UI Authentication:**
- Cloudflare Access (production)
- Dev mode: Skip validation, decode JWT from `cf-access-jwt-assertion` header

### Key Features
- ✅ OAuth 2.1 compliant (RFC 8414, PKCE, dynamic registration)
- ✅ Dual authentication (OAuth + PAT)
- ✅ Session management (track and revoke OAuth sessions)
- ✅ Tier-based permissions (4 levels)
- ✅ Token revocation (immediate for both OAuth and PAT)
- ✅ Audit logging (track sensitive operations)
- ✅ Jewel ownership (user-owned credentials)
- ✅ Beautiful UI (quantum-themed authorization pages)
- ✅ Dev mode (skip validation for local testing)

### Local Development Setup

**⚠️ CRITICAL: Initialize database before first run!**

```bash
# 1. Install dependencies
npm install
cd frontend && npm install && cd ..

# 2. Initialize database (REQUIRED - creates all tables)
npm run db:reset
# Without this: D1_ERROR: no such table: zoku

# 3. Configure admin user in .dev.vars (already set)
# ADMIN_EMAIL=dev@reset.tech
# This user will auto-promote to 'prime' tier on first login

# 4. Generate dev JWT for web UI
node scripts/generate-dev-jwt.js dev@reset.tech

# 5. Add header via ModHeader extension:
# cf-access-jwt-assertion: <jwt>

# 6. Start servers (separate terminals)
npm run dev              # Backend on :8789
cd frontend && npm run dev  # Frontend on :3000

# MCP clients use OAuth (no manual config needed):
{
  "mcpServers": {
    "zoku_local": { "url": "http://localhost:3000/mcp" }
  }
}
```

**Database Commands:**
```bash
# Local database
npm run db:reset          # Drop and recreate (schema + seed)
npm run db:migrate        # Apply schema.sql
npm run db:seed          # Load taxonomy seed data

# Production database
npm run db:migrate:remote # Apply schema to production
npm run db:seed:remote   # Load seed data to production
```

**When to run migrations:**
- First time setup (local or production)
- After `rm -rf .wrangler/state` (nukes local DB)
- After schema changes (new tables/columns)
- Production deployment (one-time initial setup)

**Admin User Bootstrap:**

The `ADMIN_EMAIL` environment variable solves the chicken-and-egg problem:
- First user to log in normally becomes `coherent` (read-only)
- But if their email matches `ADMIN_EMAIL`, they become `prime` (admin)
- This gives you full access to create entanglements, assign roles, etc.

**Local:** Set in `.dev.vars`:
```bash
ADMIN_EMAIL=dev@reset.tech
```

**Production:** Set in Cloudflare dashboard or wrangler secrets:
```bash
# Option 1: In wrangler.toml [vars] section
ADMIN_EMAIL = "your-email@reset.tech"

# Option 2: As a secret (recommended for production)
wrangler secret put ADMIN_EMAIL
# Then enter: your-email@reset.tech
```

**Behavior:**
- New user with matching email → auto-created as `prime`
- Existing user with matching email → auto-promoted to `prime` on next login
- Case-insensitive email matching
- Logged clearly in authentication logs

### Documentation
See [docs/authentication.md](docs/authentication.md) for:
- Complete implementation details
- OAuth flow diagrams
- Token validation logic
- Permission matrix
- Production deployment guide
- Troubleshooting
