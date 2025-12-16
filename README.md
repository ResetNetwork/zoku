# The Great Game

A project/initiative tracking system inspired by the Quantum Thief trilogy. Stateless Cloudflare Worker with D1 database, web frontend, and MCP interface.

## Architecture

- **Backend**: Cloudflare Worker (Hono framework)
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: React + Vite + Tailwind + TanStack Query ✅
- **MCP Server**: HTTP-based at `/mcp` endpoint
- **Domain**: `zoku.205.dev`

## Core Concepts

- **Entanglement**: A project or initiative — an act of collective will
- **Zoku**: A partner/entity doing work (human or AI agent)
- **Qupt**: Activity record — updates flowing from any source
- **PASCI Matrix**: Responsibility assignment (Perform, Accountable, Control, Support, Informed)
- **Dimensions**: Taxonomy for categorizing entanglements (status, function, pillar, service area)

## Features

### Web Frontend ✅

**8 Pages:**
1. **Dashboard** - Clickable metrics, top 5 entanglements, recent activity
2. **All Entanglements** - Complete list sorted by activity
3. **All Zoku** - Team members with PASCI responsibility matrix
4. **All Activity** - Complete activity stream with filtering
5. **All Sources** - Configured sources with sync status and health monitoring
6. **All Jewels** - API tokens and OAuth connections management
7. **Entanglement Detail** - Individual project view with source management
8. **Zoku Detail** - Individual team member with editable metadata

**Key Features:**
- **Clickable Metrics**: Navigate to detail pages from dashboard stats (5 metrics)
- **Responsibility Matrix**: Entanglements × PASCI roles grid (first 5, expandable)
- **Zoku Metadata**: GitHub username, email, role, org, timezone, deal_id (editable)
- **Deal Integration**: Deal IDs link to deals.reset.tech
- **Activity Display**: Type-specific icons, expandable details, entanglement badges, client-side formatting
- **Activity Filtering**: Filter by entanglement and source type
- **Toast Notifications**: Bottom-right notifications for sync results and system events
- **Light/Dark Mode**: Theme switching with persistent preference
- **URL Routing**: Direct links to any page or entity
- **Smart Sorting**: Entanglements by activity, zoku alphabetically
- **Source Management**: Add/Edit/Delete sources with validation and access checking
- **Jewel Management**: Full CRUD for GitHub tokens, Zammad tokens, Google OAuth
- **Google OAuth**: Per-jewel OAuth flow with re-authorization
- **Health Monitoring**: Red/green/gray dots show source status with error messages
- **Manual Sync**: Functional sync button (previously TODO)
- **Console Logging**: Detailed logs for all operations
- **Responsive Design**: Mobile and desktop optimized

## Development

### Setup

```bash
# 1. Install backend dependencies
npm install

# 2. Install frontend dependencies
cd frontend && npm install && cd ..

# 3. Initialize local database (REQUIRED for first run)
npm run db:reset
# This creates all tables and loads seed data
# Without this, you'll get "no such table" errors

# 4. Start development servers (in separate terminals)
npm run dev              # Backend on :8789
cd frontend && npm run dev  # Frontend on :3000
```

### Database Initialization

**⚠️ IMPORTANT**: The D1 database must be initialized before first use.

#### Local Development (First Time Setup)
```bash
# Create tables and load seed data
npm run db:reset

# Or run separately:
npm run db:migrate  # Creates all tables from schema.sql
npm run db:seed     # Loads taxonomy dimensions from seed.sql
```

#### Production Deployment (One-Time Setup)
```bash
# Create remote database tables
npm run db:migrate:remote

# Load seed data
npm run db:seed:remote
```

**Why this is needed:**
- Cloudflare D1 databases are created empty (no tables)
- The schema is NOT automatically applied
- You must manually run migrations before the app can function
- Without migrations, you'll get: `D1_ERROR: no such table: zoku`

**When to run migrations:**
- First time setting up local development
- After `rm -rf .wrangler/state` (clears local database)
- First time deploying to production
- After adding new tables/columns (run new migration files)

### Local Development

- **Backend**: http://localhost:8787
- **Frontend**: http://localhost:5173
- **MCP Endpoint**: http://localhost:8787/mcp
- **API**: http://localhost:8787/api/*

### Testing MCP Server

1. Start the dev server: `npm run dev`
2. Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "the-great-game": {
      "url": "http://localhost:8787/mcp",
      "transport": {
        "type": "http"
      }
    }
  }
}
```

3. Restart Claude Desktop
4. MCP tools will be available for:
   - Managing entanglements (create, list, update, delete, nest)
   - Recording activity (qupts)
   - Assigning responsibilities (PASCI matrix)
   - Managing zoku entities
   - Configuring activity sources (GitHub, Zammad, Google Docs)
   - Setting taxonomy attributes

### API Endpoints

- `GET /health` - Health check
- `GET /api/entanglements` - List entanglements
- `POST /api/entanglements` - Create entanglement
- `GET /api/entanglements/:id` - Get entanglement details
- `GET /api/zoku` - List zoku entities
- `GET /api/qupts` - List activity records
- `GET /api/dimensions` - List taxonomy dimensions
- `POST /mcp` - MCP server endpoint

Full API documentation in `zoku-spec.md`.

## Source Handlers

Qupts are automatically collected from:

- **GitHub**: Repository events (push, PR, issues, comments) ✅ Tested & Working
  - Commit messages with branch and SHA (first line only)
  - PR titles with status
  - Issue links and details
  - Comment threads
  - External link icons
  - Dynamic formatting from metadata
- **Zammad**: Ticket updates and articles (tag-based filtering) ✅ Tested & Working
  - Ticket state and priority
  - Article bodies with formatting
  - Type indicators (email, note, phone) using consistent icons
  - URL stored in jewel
- **Google Drive**: Document revisions and comments ✅ Tested & Working
  - Revision history with author and email
  - Comments with quoted/highlighted text
  - Resolved status tracking
  - Per-jewel OAuth (no system-wide config)
  - Health monitoring with access validation

Sources are configured per-entanglement and run on a 5-minute cron schedule.

### Jewel Store (Recommended)

Store jewels once, reuse across multiple sources:

```javascript
// 1. Store jewel with validation
add_jewel({
  name: "GitHub - Personal",
  type: "github",
  data: { token: "ghp_xxx" }
})
// Returns: { id: "cred-123", validation: { authenticated_as: "user", scopes: [...] } }

// 2. Create source using stored jewel
add_source({
  entanglement_id: "vol-1",
  type: "github",
  config: { owner: "ResetNetwork", repo: "zoku", events: ["push", "pull_request"] },
  jewel_id: "cred-123"
})
```

**Benefits:**
- Validate jewels before storage
- Reuse across multiple repos/sources
- Easy jewel rotation
- Track which sources use each jewel

**Zammad Tag-Based Filtering:**
Zammad sources require a `tag` field to filter tickets:
```javascript
add_source({
  type: "zammad",
  config: {
    url: "https://help.reset.tech",
    tag: "zoku",  // REQUIRED - only tickets with this tag
    include_articles: true
  },
  jewel_id: "cred-123"
})
```

### MCP Tools

29 tools available via MCP interface at `/mcp`:
- 7 Entanglement management
- 3 Activity (qupts)
- 3 Zoku entities
- 3 PASCI matrix
- 3 Taxonomy
- 4 Sources
- 6 Jewels (store, validate, rotate)

**Simplified Responses:**
All list/get tools support optional `detailed` parameter:
- Default (detailed=false): Minimal data, counts only
- Detailed (detailed=true): Full nested data with metadata

Example:
```javascript
get_entanglement({ id: "..." })  // Returns: { name, children_count, qupts_count }
get_entanglement({ id: "...", detailed: true })  // Returns: { name, children: [...], matrix, qupts: [...] }
```

## Deployment

```bash
# Deploy to Cloudflare
npm run deploy

# Run migrations on production
npm run db:migrate:remote
npm run db:seed:remote
```

## Project Structure

```
the-great-game/
├── src/
│   ├── index.ts              # Worker entry point
│   ├── types.ts              # TypeScript types
│   ├── db.ts                 # Database helpers
│   ├── scheduled.ts          # Cron handler
│   ├── lib/
│   │   └── crypto.ts         # Jewel encryption
│   ├── api/                  # REST API routes
│   │   ├── entanglements.ts
│   │   ├── zoku.ts
│   │   ├── qupts.ts
│   │   ├── sources.ts
│   │   └── dimensions.ts
│   ├── handlers/             # Source collectors
│   │   ├── index.ts
│   │   ├── github.ts
│   │   ├── zammad.ts
│   │   ├── gdocs.ts
│   │   └── google-auth.ts
│   └── mcp/
│       └── server.ts         # MCP implementation
├── frontend/                 # React app ✅
│   ├── src/
│   │   ├── App.tsx          # Main app with routing
│   │   ├── components/
│   │   │   ├── Dashboard.tsx      # Root entanglements + recent activity
│   │   │   ├── EntanglementDetail.tsx # Nested view with sources
│   │   │   └── QuptItem.tsx       # Expandable activity items
│   │   └── lib/
│   │       ├── api.ts       # API client
│   │       └── theme.ts     # Theme management
├── schema.sql               # Database schema
├── seed.sql                 # Initial data
└── wrangler.toml           # Cloudflare config
```

## License

MIT
