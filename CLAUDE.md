# The Great Game - Claude Context

## Project Overview
The Great Game is a project/initiative tracking system inspired by the Quantum Thief trilogy. Built as a Cloudflare Worker with D1 database, MCP interface, and web frontend.

## Current Status: ✅ Full-Stack Application Complete

### Completed Phases (0-5.6)
- **Phase 0**: Infrastructure setup (GitHub, D1, encryption)
- **Phase 1**: Dependencies and database schema
- **Phase 2**: Full REST API with CRUD operations
- **Phase 3**: Source handlers (GitHub, Zammad, Google Drive)
- **Phase 4**: MCP Server with 29 tools (includes jewel store)
- **Phase 5**: React frontend with light/dark mode
- **Phase 5.5**: Source & Jewel Management + Google OAuth
- **Phase 5.6**: Comprehensive Structured Logging ✅ NEW

### Remaining Phases
- **Phase 6**: Production deployment to zoku.205.dev (pending)

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

### Backend
- `src/index.ts` - Worker entry point, route mounting
- `src/db.ts` - Database query helpers (DB class)
- `src/types.ts` - TypeScript type definitions
- `src/scheduled.ts` - Cron handler for source collection
- `src/mcp/server.ts` - MCP server implementation (29 tools)
- `src/lib/logger.ts` - Structured logging class (NEW)
- `src/middleware/logging.ts` - Hono logging middleware (NEW)

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
- `frontend/src/lib/api.ts` - API client with TypeScript types
- `frontend/src/lib/theme.ts` - Theme management (light/dark mode)
- `frontend/src/lib/notifications.tsx` - Toast notification system (NEW)

### API Routes
- `src/api/entanglements.ts` - Entanglement CRUD + matrix + attributes + sources
- `src/api/zoku.ts` - Zoku CRUD
- `src/api/qupts.ts` - Qupt CRUD + batch import
- `src/api/sources.ts` - Source operations by ID
- `src/api/dimensions.ts` - Taxonomy read-only
- `src/api/jewels.ts` - Jewel store CRUD (NEW)

### Source Handlers
- `src/handlers/index.ts` - Handler registry
- `src/handlers/github.ts` - GitHub Events API
- `src/handlers/zammad.ts` - Zammad tickets + articles
- `src/handlers/gdocs.ts` - Google Docs revisions
- `src/handlers/google-auth.ts` - OAuth token refresh
- `src/handlers/validate.ts` - Jewel validation (NEW)

### Database
- `schema.sql` - Full schema with all tables
- `seed.sql` - Initial taxonomy data
- `migrations/002_add_jewels.sql` - Jewel store migration
- `migrations/003_add_zoku_description.sql` - Zoku description field (NEW)

## Development Commands

```bash
# Backend dev server
npm run dev              # Starts on :8788

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

## Next Steps

1. **Phase 6** - Deploy to production at zoku.205.dev
   - Build frontend assets
   - Deploy worker with assets
   - Run production migrations
   - Configure Cloudflare Access
   - Test full stack in production

## Notes for Future Claude Sessions

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
- **Frontend Complete**: Full app with 8 pages (Dashboard, Entanglements, Zoku, Activity, Sources, Jewels, + detail pages)
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
- **Dev Setup**: Backend on :8788, frontend on :3000, run in separate terminals
- **Vite Proxy**: Frontend proxies /api and /mcp to http://localhost:8788
- **Zoku Metadata**: Description, GitHub username, email, role, org, timezone, deal_id (all editable)
- **Responsibility Matrix**: Entanglements × PASCI roles grid view on Zoku page
- **Navigation**: Clickable metrics, URL routing, direct links to any entity, clickable entanglements in matrix
- **Counts**: All views show zoku_count, qupts_count, sources_count, children_count
- **Example Data**: 15 zoku + 7 entanglements with PASCI assignments
- **Notifications**: Toast system with success/error/info types, auto-dismiss
- **OAuth Callback**: 5-second success message before auto-close
- **Structured Logging**: Comprehensive JSON logs with request/session IDs, duration tracking ✅ NEW
- **Log Middleware**: Automatic logging for all HTTP requests (info/warn/error/fatal levels)
- **Session Tracking**: Frontend generates session IDs, propagates via X-Zoku-Session-ID header
- **Request Correlation**: 8-char request IDs for tracing operations across logs
- **MCP Logging**: Tool execution timing and results logged automatically
- **Source Sync Logging**: Per-source success/failure tracking with error messages
- **Log Levels**: Configurable via LOG_LEVEL env var (default: info, supports: info/warn/error/fatal)
- **Performance**: < 2ms overhead per request, no database writes
- **Viewing Logs**: `wrangler tail` for production, console for local dev
