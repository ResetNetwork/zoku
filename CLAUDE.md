# Zoku - Claude Context

## Project Overview
Zoku is a project/initiative tracking system inspired by the Quantum Thief trilogy. Built as a Cloudflare Worker with D1 database, MCP interface, and web frontend.

## Current Status: ✅ Full-Stack Application Complete

### Completed Phases (0-5)
- **Phase 0**: Infrastructure setup (GitHub, D1, encryption)
- **Phase 1**: Dependencies and database schema
- **Phase 2**: Full REST API with CRUD operations
- **Phase 3**: Source handlers (GitHub, Zammad, Google Docs)
- **Phase 4**: MCP Server with 29 tools (includes credential store)
- **Phase 5**: React frontend with light/dark mode ✅ NEW

### Remaining Phases
- **Phase 6**: Production deployment to zoku.205.dev (pending)

## Architecture

### Core Concepts
- **Volition**: A project/initiative (can be nested)
- **Entangled**: Partner/entity (human or AI agent)
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

### Volitions
- `list_volitions` - List projects with filters
- `get_volition` - Get full details including children and qupts
- `get_children` - Get child volitions (recursive option)
- `create_volition` - Create new project
- `update_volition` - Update name, description, parent
- `move_volition` - Change parent/make root
- `delete_volition` - Delete (requires confirmation)

### Activity (Qupts)
- `create_qupt` - Record activity manually
- `list_qupts` - List activity (recursive aggregation from children)

### Entangled Entities
- `list_entangled` - List all partners
- `create_entangled` - Register new partner
- `get_entangled` - Get details with volitions

### PASCI Matrix
- `entangle` - Assign entity to role
- `disentangle` - Remove from role
- `get_matrix` - View full responsibility matrix

### Taxonomy
- `list_dimensions` - Get all dimensions and values
- `set_attributes` - Set volition attributes
- `get_attributes` - Get volition attributes

### Sources
- `list_sources` - List configured sources
- `add_source` - Add GitHub/Zammad/Google Docs source (supports credential_id)
- `sync_source` - Trigger manual sync (fully implemented)
- `remove_source` - Delete source
- `toggle_source` - Enable/disable source

### Credentials (NEW)
- `add_credential` - Store and validate credentials for reuse
- `list_credentials` - View stored credentials (encrypted data hidden)
- `get_credential` - Get credential details
- `update_credential` - Rotate/update credentials
- `delete_credential` - Remove credential (blocks if in use)
- `get_credential_usage` - See which sources use a credential

## Key Files

### Backend
- `src/index.ts` - Worker entry point, route mounting
- `src/db.ts` - Database query helpers (DB class)
- `src/types.ts` - TypeScript type definitions
- `src/scheduled.ts` - Cron handler for source collection
- `src/mcp/server.ts` - MCP server implementation (29 tools)

### Frontend
- `frontend/src/App.tsx` - Main app with URL routing and view management
- `frontend/src/components/Dashboard.tsx` - Home with clickable metrics, top 5 volitions, recent activity
- `frontend/src/components/VolitionsList.tsx` - All volitions with stats
- `frontend/src/components/VolitionDetail.tsx` - Individual volition with responsibilities, sources, activity
- `frontend/src/components/EntangledList.tsx` - All entangled with PASCI responsibility matrix
- `frontend/src/components/EntangledDetail.tsx` - Individual entangled with editable metadata
- `frontend/src/components/ActivityList.tsx` - All activity across volitions
- `frontend/src/components/SourcesList.tsx` - All configured sources
- `frontend/src/components/QuptItem.tsx` - Expandable activity items with type-specific formatting
- `frontend/src/lib/api.ts` - API client with TypeScript types
- `frontend/src/lib/theme.ts` - Theme management (light/dark mode)
- `frontend/src/lib/notifications.tsx` - Toast notification system (NEW)

### API Routes
- `src/api/volitions.ts` - Volition CRUD + matrix + attributes + sources
- `src/api/entangled.ts` - Entangled CRUD
- `src/api/qupts.ts` - Qupt CRUD + batch import
- `src/api/sources.ts` - Source operations by ID
- `src/api/dimensions.ts` - Taxonomy read-only
- `src/api/credentials.ts` - Credential store CRUD (NEW)

### Source Handlers
- `src/handlers/index.ts` - Handler registry
- `src/handlers/github.ts` - GitHub Events API
- `src/handlers/zammad.ts` - Zammad tickets + articles
- `src/handlers/gdocs.ts` - Google Docs revisions
- `src/handlers/google-auth.ts` - OAuth token refresh
- `src/handlers/validate.ts` - Credential validation (NEW)

### Database
- `schema.sql` - Full schema with all tables
- `seed.sql` - Initial taxonomy data
- `migrations/002_add_credentials.sql` - Credential store migration
- `migrations/003_add_entangled_description.sql` - Entangled description field (NEW)

## Development Commands

```bash
# Backend dev server
npm run dev              # Starts on :8787

# Frontend dev server
cd frontend && npm run dev  # Starts on :5173

# Database operations
npm run db:migrate        # Local migration
npm run db:seed          # Local seed
npm run db:reset         # Migrate + seed
npm run db:migrate:remote # Production migration
npm run db:seed:remote   # Production seed

# Deployment
npm run deploy           # Deploy to Cloudflare
```

## Frontend Features

- **Dashboard View**:
  - Clickable metrics for navigation (7 volitions, 13 entangled, activity, sources)
  - Top 5 volitions sorted by recent activity
  - Recent 10 qupts with volition badges
  - "View all" links to dedicated pages
  - Sync all sources button

- **Volition Pages**:
  - All Volitions: Complete list with stats
  - Volition Detail: Responsibilities, sources, activity stream
  - Shows entangled, qupts, and sources counts

- **Entangled Pages**:
  - All Entangled: List with stats and PASCI responsibility matrix
  - Entangled Detail: Metadata fields, assigned volitions with roles
  - Editable fields: description, GitHub username, email, role, org, timezone, deal_id
  - Deal ID links to deals.reset.tech

- **Activity & Sources Pages**:
  - Activity List: All qupts across volitions with source badges
  - Sources List: All configured sources with sync status

- **Responsibility Matrix** (on Entangled page):
  - Volitions as rows, PASCI roles as columns
  - Shows first 5, expandable to all
  - Sorted alphabetically
  - Clickable entangled badges

- **Activity Display**:
  - Type-specific icons for different event types
  - GitHub: Commit SHA, branch, PR titles, issue links
  - Zammad: Ticket state, article bodies, type indicators
  - Expandable details on click
  - External link icons for URLs
  - Volition badges on cross-volition views

- **Theme Support**:
  - Light/dark mode toggle
  - Persistent theme preference
  - Quantum-themed color palette

- **URL Routing**:
  - Direct links to any page or entity
  - Browser back/forward support
  - Shareable URLs

## Source Configuration

Sources can use stored credentials (recommended) or inline credentials. All credentials are encrypted at rest using ENCRYPTION_KEY.

### Credential Store Workflow (Recommended)
```javascript
// 1. Store credential once (validates and encrypts)
add_credential({
  name: "GitHub - Personal",
  type: "github",
  data: { token: "ghp_xxx" }
})
// Returns: { id: "cred-123", validation: { authenticated_as: "username", scopes: [...] } }

// 2. Reuse for multiple sources
add_source({
  volition_id: "vol-1",
  type: "github",
  config: { owner: "ResetNetwork", repo: "zoku", events: ["push", "pull_request", "issues"] },
  credential_id: "cred-123"  // Reference stored credential
})
```

### Inline Credentials (Legacy)
```json
{
  "type": "github",
  "config": {
    "owner": "ResetNetwork",
    "repo": "zoku",
    "events": ["push", "pull_request", "issues"]
  },
  "credentials": {
    "token": "ghp_xxx"
  }
}
```

### Zammad Example
```javascript
// Using credential_id (recommended)
add_source({
  volition_id: "vol-1",
  type: "zammad",
  config: {
    url: "https://help.reset.tech",
    tag: "zoku",  // REQUIRED - only tickets with this tag
    include_articles: true
  },
  credential_id: "cred-zammad-123"
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
  "credentials": {
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
- Unlimited depth for volitions
- Qupts aggregate from all descendants by default
- Deletion cascades to children

### Deduplication
- Qupts use `external_id` with unique index `(source, external_id)`
- Format: `github:{id}`, `zammad:ticket:{id}:{timestamp}`, `gdocs:{doc_id}:rev:{id}`

## API Endpoints

### Health
- `GET /health` - Health check

### Volitions
- `GET /api/volitions` - List (supports filtering)
- `POST /api/volitions` - Create
- `GET /api/volitions/:id` - Get details
- `PATCH /api/volitions/:id` - Update
- `DELETE /api/volitions/:id` - Delete
- `GET /api/volitions/:id/matrix` - Get PASCI matrix
- `POST /api/volitions/:id/matrix` - Assign to matrix
- `DELETE /api/volitions/:id/matrix/:entangled_id/:role` - Remove from matrix
- `GET /api/volitions/:id/attributes` - Get attributes
- `PUT /api/volitions/:id/attributes` - Set attributes (replace all)
- `POST /api/volitions/:id/attributes` - Add single attribute
- `DELETE /api/volitions/:id/attributes/:dimension_id` - Remove attributes
- `GET /api/volitions/:id/sources` - List sources
- `POST /api/volitions/:id/sources` - Add source

### Entangled
- `GET /api/entangled` - List
- `POST /api/entangled` - Create
- `GET /api/entangled/:id` - Get details
- `PATCH /api/entangled/:id` - Update
- `DELETE /api/entangled/:id` - Delete

### Qupts
- `GET /api/qupts` - List (with filters)
- `POST /api/qupts` - Create
- `POST /api/qupts/batch` - Batch create
- `GET /api/qupts/:id` - Get single
- `DELETE /api/qupts/:id` - Delete

### Sources
- `GET /api/sources/:id` - Get details (no credentials)
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
- All credentials are AES-GCM encrypted using ENCRYPTION_KEY secret
- Scheduled handler runs every 5 minutes via Cloudflare Cron
- **Credential Store**: 29 MCP tools total (23 original + 6 credential tools)
- **Local dev**: ENCRYPTION_KEY set in `.dev.vars` (not committed to git)
- **Validation**: GitHub, Zammad, Google Docs credentials validated on add/update
- **Testing**: Successfully tested end-to-end with GitHub (5 qupts) and Zammad (1 qupt)
- **Simplified Responses**: All tools support optional `detailed` parameter for verbose output
- **Zammad**: Tag-based filtering required - `tag` field mandatory in config
- **Response Size**: 60-80% reduction with default (non-detailed) responses
- **Frontend Complete**: Full app with 7 pages (Dashboard, Volitions, Entangled, Activity, Sources, + detail pages)
- **Theme**: Light/dark mode with localStorage persistence
- **Activity Formatting**: Type-specific icons and expandable details for GitHub/Zammad events
- **Dev Setup**: Backend on :8787, frontend on :5173, run in separate terminals
- **Entangled Metadata**: Description, GitHub username, email, role, org, timezone, deal_id
- **Responsibility Matrix**: Volitions × PASCI roles grid view on Entangled page
- **Navigation**: Clickable metrics, URL routing, direct links to any entity
- **Counts**: All views show entangled_count, qupts_count, sources_count, children_count
- **Example Data**: 12 entangled (8 humans, 4 AI agents) + 6 volitions with PASCI assignments
- **Notifications**: Toast notification system in bottom-right for sync results and system events
