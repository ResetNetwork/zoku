# The Great Game

A project/initiative tracking system inspired by the Quantum Thief trilogy. Stateless Cloudflare Worker with D1 database, web frontend, and MCP interface.

## Architecture

- **Backend**: Cloudflare Worker (Hono framework)
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: React + Vite + Tailwind + TanStack Query ✅
- **MCP Server**: HTTP-based at `/mcp` endpoint
- **Domain**: Custom domain support (e.g., `tgg.yourdomain.com`)

## Name

**Zoku** (族) - Japanese for "tribe" or "clan". Represents collaborative teams working together on entangled projects through quantum connections.

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

## Production Deployment

### Prerequisites

1. **Cloudflare Account** with Workers and D1 enabled
2. **Wrangler CLI** authenticated: `npx wrangler login`
3. **Custom domain** (optional): tgg.yourdomain.com

### One-Command Deployment Script

Already included as `deploy.sh` in the repository:

```bash
#!/bin/bash
set -e

echo "🚀 Deploying The Great Game to Cloudflare..."

# 1. Create KV namespace (skip if exists)
echo "📦 Creating KV namespace..."
KV_OUTPUT=$(npx wrangler kv namespace create AUTH_KV 2>&1 || true)
if echo "$KV_OUTPUT" | grep -q "id ="; then
  KV_ID=$(echo "$KV_OUTPUT" | grep "id =" | cut -d'"' -f2)
  echo "✅ KV created: $KV_ID"
  echo "⚠️  Update wrangler.toml: [[kv_namespaces]] id = \"$KV_ID\""
  read -p "Press Enter after updating wrangler.toml..."
fi

# 2. Set secrets
echo "🔐 Setting secrets..."
echo "Generate ENCRYPTION_KEY:"
openssl rand -base64 32
read -p "Copy above key, then press Enter..."
npx wrangler secret put ENCRYPTION_KEY

echo "Generate JWT_SECRET:"
openssl rand -base64 32
read -p "Copy above key, then press Enter..."
npx wrangler secret put JWT_SECRET

read -p "Enter admin email (e.g., admin@example.com): " ADMIN_EMAIL
echo "$ADMIN_EMAIL" | npx wrangler secret put ADMIN_EMAIL

# 3. Initialize database
echo "🗄️  Initializing database..."
npx wrangler d1 execute the-great-game --remote --file=./schema.sql
npx wrangler d1 execute the-great-game --remote --file=./seed.sql

# 4. Build frontend
echo "🎨 Building frontend..."
cd frontend && npm install && npm run build && cd ..

# 5. Deploy
echo "🚢 Deploying worker..."
npx wrangler deploy

echo "✅ Deployment complete!"
echo "🌐 Testing deployment..."
WORKER_URL=$(npx wrangler deployments list --json 2>/dev/null | grep -o 'https://[^"]*' | head -1)
curl -s "$WORKER_URL/health" | jq .

echo ""
echo "📋 Next steps:"
echo "1. Configure custom domain (if needed): npx wrangler domains add tgg.yourdomain.com"
echo "2. Setup Cloudflare Access at: https://one.dash.cloudflare.com/"
echo "3. (Optional) Customize branding: Set VITE_APP_NAME in frontend/.env"
echo "4. Visit your app and login to create admin user"
```

Make executable and run:
```bash
chmod +x deploy.sh
./deploy.sh
```

### Manual Step-by-Step Deployment

#### 1. Create Production KV Namespace

```bash
# Create KV namespace for OAuth state and sessions
npx wrangler kv namespace create AUTH_KV

# Example output:
# { binding = "AUTH_KV", id = "abc123xyz456" }
```

Update `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "AUTH_KV"
id = "abc123xyz456"              # Replace with your actual ID
preview_id = "def789uvw012"      # Optional, from: npx wrangler kv namespace create AUTH_KV --preview
```

#### 2. Set Production Secrets

```bash
# Generate and set encryption key
openssl rand -base64 32  # Copy output
npx wrangler secret put ENCRYPTION_KEY
# Paste the key when prompted

# Generate and set JWT secret
openssl rand -base64 32  # Copy output
npx wrangler secret put JWT_SECRET
# Paste the key when prompted

# Set admin email
npx wrangler secret put ADMIN_EMAIL
# Enter: your-email@example.com

# Verify secrets are set
npx wrangler secret list
```

#### 3. Initialize Database

```bash
# Apply schema (creates all tables)
npx wrangler d1 execute the-great-game --remote --file=./schema.sql

# Load seed data (taxonomy dimensions)
npx wrangler d1 execute the-great-game --remote --file=./seed.sql

# Verify tables exist
npx wrangler d1 execute the-great-game --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table'"
```

#### 4. Build and Deploy

```bash
# Install frontend dependencies
cd frontend && npm install && cd ..

# Build frontend assets
npm run build:frontend

# Deploy worker with assets
npx wrangler deploy

# View deployment URL
npx wrangler deployments list
```

#### 5. Configure Custom Domain

```bash
# Add custom domain via Wrangler
npx wrangler domains add tgg.yourdomain.com

# Or manually add route to wrangler.toml and redeploy:
# routes = [{ pattern = "tgg.yourdomain.com/*", zone_name = "yourdomain.com" }]
npx wrangler deploy
```

#### 5.5. Customize Branding (Optional)

```bash
# Set custom app name to show next to logo
echo 'VITE_APP_NAME=Your Organization' > frontend/.env

# Or leave empty for logo-only (default)

# Rebuild frontend with branding
cd frontend && npm run build && cd ..

# Redeploy
npx wrangler deploy
```

See `frontend/CUSTOMIZATION.md` for details.

#### 6. Setup Cloudflare Access (Web UI Auth)

```bash
# Open Cloudflare dashboard
npx wrangler open

# Navigate to: Zero Trust → Access → Applications → Add an application
# - Type: Self-hosted
# - Name: The Great Game (or Zoku)
# - Domain: tgg.yourdomain.com
# - Policy: Allow emails @yourdomain.com (or specific users)
```

#### 7. Verify Deployment

```bash
# Get worker URL
npx wrangler deployments list

# Test health endpoint
curl https://the-great-game.your-subdomain.workers.dev/health
# Or with custom domain:
curl https://tgg.yourdomain.com/health

# Test OAuth metadata
curl https://tgg.yourdomain.com/.well-known/oauth-authorization-server | jq .

# Tail logs
npx wrangler tail --format pretty
```

#### 8. Create First Admin User

```bash
# Visit your deployed URL and login via Cloudflare Access
# User will be auto-created as 'prime' tier if email matches ADMIN_EMAIL

# Or manually promote after first login:
npx wrangler d1 execute the-great-game --remote \
  --command "SELECT id, email, access_tier FROM zoku WHERE type='human'"

# Promote to prime tier (replace YOUR-USER-ID)
npx wrangler d1 execute the-great-game --remote \
  --command "UPDATE zoku SET access_tier='prime' WHERE id='YOUR-USER-ID'"

# Verify promotion
npx wrangler d1 execute the-great-game --remote \
  --command "SELECT id, name, email, access_tier FROM zoku WHERE type='human'"
```

### Post-Deployment Checklist

- [ ] KV namespace created and configured
- [ ] Secrets set (ENCRYPTION_KEY, JWT_SECRET, ADMIN_EMAIL)
- [ ] Database migrated and seeded
- [ ] Frontend built and deployed
- [ ] Cloudflare Access configured (or dev JWT setup)
- [ ] Worker deployed successfully
- [ ] Custom domain configured (optional)
- [ ] Health endpoint responds
- [ ] Admin user created and verified
- [ ] MCP OAuth endpoint accessible
- [ ] Cron trigger active (check Workers dashboard)

### Environment Variables

**Production Secrets (via `wrangler secret put`):**
- `ENCRYPTION_KEY` - AES-256-GCM key for jewels/OAuth apps (required)
- `JWT_SECRET` - HMAC key for MCP tokens (required)
- `ADMIN_EMAIL` - Auto-promote user to prime tier (optional)

**Public Variables (in `wrangler.toml`):**
- `LOG_LEVEL` - Logging level: info, warn, error, fatal (default: info)

**Bindings (in `wrangler.toml`):**
- `DB` - D1 database binding
- `AUTH_KV` - KV namespace for OAuth state and sessions

### Rollback

```bash
# View recent deployments
npx wrangler deployments list

# Rollback to previous version
npx wrangler rollback <version-id>
```

### Monitoring

```bash
# Tail logs in production
npx wrangler tail --format pretty

# Filter errors only
npx wrangler tail --format pretty | grep '"level":"error"'

# View specific request
npx wrangler tail --format pretty | grep '"request_id":"abc12345"'
```

### Troubleshooting

**"No such table" errors:**
```bash
npm run db:migrate:remote
npm run db:seed:remote
```

**"ENCRYPTION_KEY not configured":**
```bash
npx wrangler secret put ENCRYPTION_KEY
# Paste: openssl rand -base64 32 output
```

**"Invalid authentication token" on web UI:**
- Verify Cloudflare Access is configured
- Check `Cf-Access-Jwt-Assertion` header exists
- Ensure ADMIN_EMAIL matches your login email

**MCP OAuth not working:**
- Verify JWT_SECRET is set
- Check AUTH_KV namespace is bound
- Test metadata: `curl https://tgg.yourdomain.com/.well-known/oauth-authorization-server`

**Cron not running:**
- Check Workers dashboard → Triggers → Crons
- Should show: `*/5 * * * *` (every 5 minutes)
- View logs: `npx wrangler tail | grep scheduled`

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
