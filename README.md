# Zoku

A project/initiative tracking system inspired by the Quantum Thief trilogy. Stateless Cloudflare Worker with D1 database, web frontend, and MCP interface.

## Architecture

- **Backend**: Cloudflare Worker (Hono framework)
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: React + Vite + Tailwind (coming soon)
- **MCP Server**: HTTP-based at `/mcp` endpoint
- **Domain**: `zoku.205.dev`

## Core Concepts

- **Volition**: A project or initiative — an act of collective will
- **Entangled**: A partner/entity doing work (human or AI agent)
- **Qupt**: Activity record — updates flowing from any source
- **PASCI Matrix**: Responsibility assignment (Perform, Accountable, Control, Support, Informed)
- **Dimensions**: Taxonomy for categorizing volitions (status, function, pillar, service area)

## Development

### Setup

```bash
# Install dependencies
npm install

# Run database migrations
npm run db:migrate
npm run db:seed

# Start development server
npm run dev
```

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

- **GitHub**: Repository events (push, PR, issues)
- **Zammad**: Ticket updates and articles
- **Google Docs**: Document revisions

Sources are configured per-volition and run on a 5-minute cron schedule.

### Adding a Source

```bash
curl -X POST http://localhost:8787/api/volitions/{volition_id}/sources \
  -H "Content-Type: application/json" \
  -d '{
    "type": "github",
    "config": {
      "owner": "ResetNetwork",
      "repo": "zoku",
      "events": ["push", "pull_request", "issues"]
    },
    "credentials": {
      "token": "ghp_your_github_token"
    }
  }'
```

Credentials are automatically encrypted using the `ENCRYPTION_KEY` secret.

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
├── frontend/                 # React app (coming soon)
├── schema.sql               # Database schema
├── seed.sql                 # Initial data
└── wrangler.toml           # Cloudflare config
```

## License

MIT
