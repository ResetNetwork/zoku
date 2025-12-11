# Zoku

A project/initiative tracking system inspired by the Quantum Thief trilogy. Stateless Cloudflare Worker with D1 database, web frontend, and MCP interface.

## Architecture

- **Backend**: Cloudflare Worker (Hono framework)
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: React + Vite + Tailwind + TanStack Query ✅
- **MCP Server**: HTTP-based at `/mcp` endpoint
- **Domain**: `zoku.205.dev`

## Core Concepts

- **Volition**: A project or initiative — an act of collective will
- **Entangled**: A partner/entity doing work (human or AI agent)
- **Qupt**: Activity record — updates flowing from any source
- **PASCI Matrix**: Responsibility assignment (Perform, Accountable, Control, Support, Informed)
- **Dimensions**: Taxonomy for categorizing volitions (status, function, pillar, service area)

## Features

### Web Frontend ✅

**7 Pages:**
1. **Dashboard** - Clickable metrics, top 5 volitions, recent activity
2. **All Volitions** - Complete list sorted by activity
3. **All Entangled** - Team members with PASCI responsibility matrix
4. **All Activity** - Complete activity stream across volitions
5. **All Sources** - Configured sources with sync status
6. **Volition Detail** - Individual project view
7. **Entangled Detail** - Individual team member with editable metadata

**Key Features:**
- **Clickable Metrics**: Navigate to detail pages from dashboard stats
- **Responsibility Matrix**: Volitions × PASCI roles grid (first 5, expandable)
- **Entangled Metadata**: GitHub username, email, role, org, timezone, deal_id (editable)
- **Deal Integration**: Deal IDs link to deals.reset.tech
- **Activity Display**: Type-specific icons, expandable details, volition badges
- **Light/Dark Mode**: Theme switching with persistent preference
- **URL Routing**: Direct links to any page or entity
- **Smart Sorting**: Volitions by activity, entangled alphabetically
- **Source Management**: Configure and sync GitHub/Zammad/Google Docs sources
- **Responsive Design**: Mobile and desktop optimized

## Development

### Setup

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Run database migrations
npm run db:migrate
npm run db:seed

# Start development servers (in separate terminals)
npm run dev              # Backend on :8787
cd frontend && npm run dev  # Frontend on :5173
```

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
    "zoku": {
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
   - Managing volitions (create, list, update, delete, nest)
   - Recording activity (qupts)
   - Assigning responsibilities (PASCI matrix)
   - Managing entangled entities
   - Configuring activity sources (GitHub, Zammad, Google Docs)
   - Setting taxonomy attributes

### API Endpoints

- `GET /health` - Health check
- `GET /api/volitions` - List volitions
- `POST /api/volitions` - Create volition
- `GET /api/volitions/:id` - Get volition details
- `GET /api/entangled` - List entangled entities
- `GET /api/qupts` - List activity records
- `GET /api/dimensions` - List taxonomy dimensions
- `POST /mcp` - MCP server endpoint

Full API documentation in `zoku-spec.md`.

## Source Handlers

Qupts are automatically collected from:

- **GitHub**: Repository events (push, PR, issues, comments) ✅ Tested & Working
  - Commit messages with branch and SHA
  - PR titles fetched and displayed
  - Issue links and details
  - External link icons
- **Zammad**: Ticket updates and articles (tag-based filtering) ✅ Tested & Working
  - Ticket state and priority
  - Article bodies with formatting
  - Type indicators (email, note, phone)
- **Google Docs**: Document revisions (ready, not tested)

Sources are configured per-volition and run on a 5-minute cron schedule.

### Credential Store (Recommended)

Store credentials once, reuse across multiple sources:

```javascript
// 1. Store credential with validation
add_credential({
  name: "GitHub - Personal",
  type: "github",
  data: { token: "ghp_xxx" }
})
// Returns: { id: "cred-123", validation: { authenticated_as: "user", scopes: [...] } }

// 2. Create source using stored credential
add_source({
  volition_id: "vol-1",
  type: "github",
  config: { owner: "ResetNetwork", repo: "zoku", events: ["push", "pull_request"] },
  credential_id: "cred-123"
})
```

**Benefits:**
- Validate credentials before storage
- Reuse across multiple repos/sources
- Easy credential rotation
- Track which sources use each credential

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
  credential_id: "cred-123"
})
```

### MCP Tools

29 tools available via MCP interface at `/mcp`:
- 7 Volition management
- 3 Activity (qupts)
- 3 Entangled entities
- 3 PASCI matrix
- 3 Taxonomy
- 4 Sources
- 6 Credentials (store, validate, rotate)

**Simplified Responses:**
All list/get tools support optional `detailed` parameter:
- Default (detailed=false): Minimal data, counts only
- Detailed (detailed=true): Full nested data with metadata

Example:
```javascript
get_volition({ id: "..." })  // Returns: { name, children_count, qupts_count }
get_volition({ id: "...", detailed: true })  // Returns: { name, children: [...], matrix, qupts: [...] }
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
zoku/
├── src/
│   ├── index.ts              # Worker entry point
│   ├── types.ts              # TypeScript types
│   ├── db.ts                 # Database helpers
│   ├── scheduled.ts          # Cron handler
│   ├── lib/
│   │   └── crypto.ts         # Credential encryption
│   ├── api/                  # REST API routes
│   │   ├── volitions.ts
│   │   ├── entangled.ts
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
│   │   │   ├── Dashboard.tsx      # Root volitions + recent activity
│   │   │   ├── VolitionDetail.tsx # Nested view with sources
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
