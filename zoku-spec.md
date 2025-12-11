# Zoku - Build Specification

A project/initiative tracking system inspired by the Quantum Thief trilogy. Stateless Cloudflare Worker with D1 database, web frontend, and MCP interface.

## 🎉 Implementation Status

### ✅ Completed (Phases 0-4)
- **Phase 0**: Repository & Infrastructure Setup - GitHub repo, D1 database, encryption key
- **Phase 1**: Project Setup - Dependencies installed, schema created & migrated, seed data loaded
- **Phase 2**: Core API - Full REST API with volitions, entangled, qupts, sources, dimensions, PASCI matrix
- **Phase 3**: Source Handlers - GitHub, Zammad, Google Docs handlers with error recovery and scheduled collection
- **Phase 4**: MCP Server - 23 tools using official @modelcontextprotocol/sdk

### 🚧 Remaining
- **Phase 5**: React Frontend with OAuth flow (pending)
- **Phase 6**: Production deployment to zoku.205.dev (pending)

**Backend is fully functional and ready to use via MCP!**

## Conceptual Model

| Term | Meaning |
|------|---------|
| **Zoku** | The system itself |
| **Volition** | A project or initiative — an act of collective will. Can be nested (parent/child). |
| **Entangled** | A partner/entity doing work (human or AI agent via MCP) |
| **Qupt** | Activity record — updates flowing from any entangled source |
| **Dimension** | A facet for categorizing volitions (status, function, pillar, etc.) |
| **Attribute** | A dimension:value assignment on a volition |

### PASCI Responsibility Matrix

Each volition has a responsibility matrix assigning entangled entities to PASCI roles:

| Role | Code | Description |
|------|------|-------------|
| **Perform** | P | The entity carrying out the activity |
| **Accountable** | A | Ultimately answerable for completion; delegates to Performer |
| **Control** | C | Reviews results; has veto power; advice is binding |
| **Support** | S | Provides expert advice; non-binding input |
| **Informed** | I | Must be notified of results |

Rules:
- Each volition must have exactly one **Accountable** (enforced by API)
- Each volition should have at least one **Perform** (warning only, not enforced)
- Multiple entities can share any role
- An entity can hold multiple roles on the same volition

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Clients                                 │
├─────────────────┬───────────────────────────────────────────────┤
│   Web Frontend  │            MCP (Claude/AI agents)             │
└────────┬────────┴──────────────────────┬────────────────────────┘
         │                               │
         ▼                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Access                            │
│              (identity, service tokens)                         │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Worker (Zoku)                     │
├──────────────┬────────────────┬──────────────┬──────────────────┤
│   /api/*     │   /mcp         │ /* (frontend)│  Cron Triggers   │
└──────────────┴────────────────┴──────────────┴──────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
     │ Cloudflare  │  │   GitHub    │  │   Gmail     │
     │     D1      │  │    API      │  │    API      │
     └─────────────┘  └─────────────┘  └─────────────┘
```

## Project Structure

```
zoku/
├── src/
│   ├── index.ts              # Worker entry, route mounting
│   ├── api/
│   │   ├── volitions.ts      # Volition CRUD routes
│   │   ├── entangled.ts      # Entangled CRUD routes
│   │   └── qupts.ts          # Qupt routes
│   ├── mcp/
│   │   └── server.ts         # MCP protocol handler + tools
│   └── db.ts                 # D1 query helpers
├── frontend/
│   ├── index.html
│   ├── app.ts
│   └── styles.css
├── schema.sql
├── wrangler.toml
├── package.json
└── tsconfig.json
```

## Taxonomy System

Volitions can be tagged with attributes across multiple dimensions. This faceted approach allows flexible categorization that can evolve over time.

### Core Concepts

| Term | Description |
|------|-------------|
| **Dimension** | A category of classification (e.g., function, pillar, service_area) |
| **Value** | An option within a dimension (e.g., "tech_innovation" in function) |
| **Attribute** | A dimension:value pair assigned to a volition |

### Schema

```sql
CREATE TABLE IF NOT EXISTS dimensions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,        -- 'function', 'pillar', 'service_area'
  label TEXT NOT NULL,              -- 'Function', 'Pillar', 'Service Area'
  description TEXT,
  allow_multiple INTEGER DEFAULT 0, -- Can volition have multiple values?
  parent_dimension_id TEXT REFERENCES dimensions(id), -- For dependent dimensions
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS dimension_values (
  id TEXT PRIMARY KEY,
  dimension_id TEXT NOT NULL REFERENCES dimensions(id) ON DELETE CASCADE,
  value TEXT NOT NULL,              -- 'tech_innovation'
  label TEXT NOT NULL,              -- 'Technology Innovation'
  description TEXT,
  parent_value_id TEXT REFERENCES dimension_values(id), -- For hierarchical values
  depends_on_value_id TEXT REFERENCES dimension_values(id), -- For conditional values
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(dimension_id, value)
);

CREATE TABLE IF NOT EXISTS volition_attributes (
  volition_id TEXT NOT NULL REFERENCES volitions(id) ON DELETE CASCADE,
  dimension_id TEXT NOT NULL REFERENCES dimensions(id) ON DELETE CASCADE,
  value_id TEXT NOT NULL REFERENCES dimension_values(id) ON DELETE CASCADE,
  assigned_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (volition_id, dimension_id, value_id)
);

CREATE INDEX IF NOT EXISTS idx_volition_attributes_volition ON volition_attributes(volition_id);
CREATE INDEX IF NOT EXISTS idx_volition_attributes_dimension ON volition_attributes(dimension_id);
CREATE INDEX IF NOT EXISTS idx_volition_attributes_value ON volition_attributes(value_id);
CREATE INDEX IF NOT EXISTS idx_dimension_values_dimension ON dimension_values(dimension_id);
CREATE INDEX IF NOT EXISTS idx_dimension_values_parent ON dimension_values(parent_value_id);
```

### Initial Seed Data

```sql
-- seed.sql

-- Dimensions
INSERT INTO dimensions (id, name, label, description, allow_multiple) VALUES
  ('dim_status', 'status', 'Status', 'Current status of the volition', 0),
  ('dim_function', 'function', 'Function', 'Primary organizational function', 0),
  ('dim_pillar', 'pillar', 'Pillar', 'Innovation pillar (Technology Innovation only)', 0),
  ('dim_service', 'service_area', 'Service Area', 'IT service area (Information Technology only)', 0);

-- Status values
INSERT INTO dimension_values (id, dimension_id, value, label, sort_order) VALUES
  ('val_draft', 'dim_status', 'draft', 'Draft', 1),
  ('val_active', 'dim_status', 'active', 'Active', 2),
  ('val_paused', 'dim_status', 'paused', 'Paused', 3),
  ('val_complete', 'dim_status', 'complete', 'Complete', 4),
  ('val_archived', 'dim_status', 'archived', 'Archived', 5);

-- Function values
INSERT INTO dimension_values (id, dimension_id, value, label, sort_order) VALUES
  ('val_tech_innovation', 'dim_function', 'tech_innovation', 'Technology Innovation', 1),
  ('val_info_tech', 'dim_function', 'info_tech', 'Information Technology', 2);

-- Pillar values (Technology Innovation)
INSERT INTO dimension_values (id, dimension_id, value, label, depends_on_value_id, sort_order) VALUES
  ('val_operational', 'dim_pillar', 'operational', 'Operational', 'val_tech_innovation', 1),
  ('val_programmatic', 'dim_pillar', 'programmatic', 'Programmatic', 'val_tech_innovation', 2),
  ('val_r_and_d', 'dim_pillar', 'r_and_d', 'R&D', 'val_tech_innovation', 3);

-- Service Area values (Information Technology)
INSERT INTO dimension_values (id, dimension_id, value, label, depends_on_value_id, sort_order) VALUES
  ('val_helpdesk', 'dim_service', 'helpdesk', 'Helpdesk', 'val_info_tech', 1),
  ('val_tools_services', 'dim_service', 'tools_services', 'Tools & Services', 'val_info_tech', 2),
  ('val_cyber_security', 'dim_service', 'cyber_security', 'Cyber Security', 'val_info_tech', 3),
  ('val_identity_access', 'dim_service', 'identity_access', 'Identity & Access', 'val_info_tech', 4);
```

### Dependency Logic

The `depends_on_value_id` field enables conditional values:
- Pillar values only apply when function = Technology Innovation
- Service Area values only apply when function = Information Technology
- Frontend should filter available values based on current selections

### API Endpoints

#### Dimensions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dimensions` | List all dimensions with their values |
| POST | `/api/dimensions` | Create new dimension |
| GET | `/api/dimensions/:id` | Get dimension with values |
| PATCH | `/api/dimensions/:id` | Update dimension |
| DELETE | `/api/dimensions/:id` | Delete dimension |

#### Dimension Values

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/dimensions/:id/values` | Add value to dimension |
| PATCH | `/api/dimensions/:id/values/:value_id` | Update value |
| DELETE | `/api/dimensions/:id/values/:value_id` | Remove value |

#### Volition Attributes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/volitions/:id/attributes` | Get all attributes for volition |
| PUT | `/api/volitions/:id/attributes` | Set attributes (replaces all) |
| POST | `/api/volitions/:id/attributes` | Add single attribute |
| DELETE | `/api/volitions/:id/attributes/:dimension_id` | Remove attribute(s) for dimension |

**Set Attributes Body:**
```json
{
  "attributes": [
    { "dimension": "function", "value": "tech_innovation" },
    { "dimension": "pillar", "value": "r_and_d" }
  ]
}
```

**Get Attributes Response:**
```json
{
  "volition_id": "vol_xxx",
  "attributes": {
    "function": {
      "dimension_id": "dim_function",
      "label": "Function",
      "values": [
        { "id": "val_tech_innovation", "value": "tech_innovation", "label": "Technology Innovation" }
      ]
    },
    "pillar": {
      "dimension_id": "dim_pillar",
      "label": "Pillar",
      "values": [
        { "id": "val_r_and_d", "value": "r_and_d", "label": "R&D" }
      ]
    }
  }
}
```

### Filtering Volitions by Attributes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/volitions?status=active&function=tech_innovation&pillar=r_and_d` | Filter by attributes |

Query params use dimension name as key, value as... value. Multiple values for same dimension use comma: `pillar=operational,programmatic`

Combined with nesting params:
- `?status=active&root_only=true` — Active top-level volitions
- `?function=tech_innovation&parent_id=vol_xxx` — Children of specific volition in TI

**Filter Query Implementation:**
```sql
-- Filtering by multiple dimensions requires joining volition_attributes
-- Example: ?status=active&function=tech_innovation
SELECT DISTINCT v.* FROM volitions v
JOIN volition_attributes va1 ON v.id = va1.volition_id
JOIN dimension_values dv1 ON va1.value_id = dv1.id
JOIN dimensions d1 ON dv1.dimension_id = d1.id
JOIN volition_attributes va2 ON v.id = va2.volition_id
JOIN dimension_values dv2 ON va2.value_id = dv2.id
JOIN dimensions d2 ON dv2.dimension_id = d2.id
WHERE d1.name = 'status' AND dv1.value = 'active'
  AND d2.name = 'function' AND dv2.value = 'tech_innovation'
  AND v.parent_id IS NULL;  -- root_only=true
```

### MCP Tools

#### list_dimensions
```json
{
  "name": "list_dimensions",
  "description": "List all taxonomy dimensions and their available values",
  "inputSchema": {
    "type": "object",
    "properties": {}
  }
}
```

#### set_attributes
```json
{
  "name": "set_attributes",
  "description": "Set taxonomy attributes on a volition (function, pillar, service area, etc.)",
  "inputSchema": {
    "type": "object",
    "properties": {
      "volition_id": { "type": "string" },
      "attributes": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "dimension": { "type": "string", "description": "Dimension name (e.g., 'function', 'pillar')" },
            "value": { "type": "string", "description": "Value within that dimension" }
          },
          "required": ["dimension", "value"]
        }
      }
    },
    "required": ["volition_id", "attributes"]
  }
}
```

#### get_attributes
```json
{
  "name": "get_attributes",
  "description": "Get taxonomy attributes assigned to a volition",
  "inputSchema": {
    "type": "object",
    "properties": {
      "volition_id": { "type": "string" }
    },
    "required": ["volition_id"]
  }
}
```

### Volition Response Update

Include attributes in volition responses:

```json
{
  "id": "vol_xxx",
  "name": "Research Bot",
  "parent_id": "vol_parent",
  "attributes": {
    "status": "active",
    "function": "tech_innovation",
    "pillar": "r_and_d"
  },
  "matrix": { ... },
  "children": [ ... ],
  "qupts": [ ... ]
}
```

### Nested Volitions

Volitions can have parent/child relationships with unlimited depth:

```
Programmatic (parent)
├── Websites
├── COMO
├── Newsletters
└── OSINT
```

**Behavior:**
- Child volitions have their own qupts, matrix, sources, and attributes
- When viewing a parent volition, qupts from all descendants are aggregated
- Each qupt in the aggregate includes `volition_id` and `volition_name` to indicate origin
- Children can inherit attributes from parent (optional, controlled by frontend)
- Deleting a parent cascades to children
- No nesting depth limit enforced

**Qupt Aggregation Query:**
```sql
-- Get qupts for volition and all descendants
WITH RECURSIVE descendants AS (
  SELECT id FROM volitions WHERE id = ?
  UNION ALL
  SELECT v.id FROM volitions v
  JOIN descendants d ON v.parent_id = d.id
)
SELECT q.*, v.name as volition_name
FROM qupts q
JOIN descendants d ON q.volition_id = d.id
JOIN volitions v ON q.volition_id = v.id
ORDER BY q.created_at DESC
LIMIT ?;
```

**API Parameters:**
- `GET /api/volitions/:id?include_children_qupts=true` — Aggregate qupts from descendants (default: true)
- `GET /api/volitions/:id?depth=2` — Limit child recursion depth
- `GET /api/qupts?volition_id=xxx&recursive=true` — Get qupts for volition tree

### Frontend Considerations

1. **Attribute Picker Component**
   - Show dimensions as sections/tabs
   - Filter values based on dependencies (show pillar OR service_area based on function)
   - Support single vs multi-select based on `allow_multiple`
   - No strict enforcement - allow any combinations, frontend just filters available options

2. **Volitions List Filtering**
   - Faceted filter sidebar
   - Show counts per attribute value
   - Clear/reset filters

3. **Dashboard Grouping**
   - Group volitions by function → pillar/service_area
   - Visual representation matching the ecosystem diagram

4. **OAuth Flow**
   - Frontend implements OAuth authorization flow for Google services (Gmail, Drive, Docs)
   - User authorizes access, frontend receives tokens and passes to API for storage
   - Store refresh tokens encrypted in source credentials

### Future Extensibility

Add new dimensions without schema changes:

```sql
-- Add a "quarter" dimension
INSERT INTO dimensions (id, name, label, allow_multiple) VALUES
  ('dim_quarter', 'quarter', 'Quarter', 0);

INSERT INTO dimension_values (id, dimension_id, value, label) VALUES
  ('val_q1_2025', 'dim_quarter', 'q1_2025', 'Q1 2025'),
  ('val_q2_2025', 'dim_quarter', 'q2_2025', 'Q2 2025');

-- Add a "priority" dimension
INSERT INTO dimensions (id, name, label, allow_multiple) VALUES
  ('dim_priority', 'priority', 'Priority', 0);

INSERT INTO dimension_values (id, dimension_id, value, label, sort_order) VALUES
  ('val_high', 'dim_priority', 'high', 'High', 1),
  ('val_medium', 'dim_priority', 'medium', 'Medium', 2),
  ('val_low', 'dim_priority', 'low', 'Low', 3);

-- Add a "tags" dimension (allow multiple)
INSERT INTO dimensions (id, name, label, allow_multiple) VALUES
  ('dim_tags', 'tags', 'Tags', 1);

INSERT INTO dimension_values (id, dimension_id, value, label) VALUES
  ('val_urgent', 'dim_tags', 'urgent', 'Urgent'),
  ('val_blocked', 'dim_tags', 'blocked', 'Blocked'),
  ('val_needs_review', 'dim_tags', 'needs_review', 'Needs Review');
```

### Example: Your Ecosystem as Nested Volitions

```
Technology Innovation (root, function=tech_innovation)
├── Operational (pillar=operational)
│   ├── Deals
│   └── reset.tech
├── Programmatic (pillar=programmatic)
│   ├── Websites
│   ├── COMO
│   ├── Newsletters
│   └── OSINT
└── R&D (pillar=r_and_d)
    ├── Research Bot
    └── Shazams

Information Technology (root, function=info_tech)
├── Helpdesk (service_area=helpdesk)
├── Tools & Services (service_area=tools_services)
├── Cyber Security (service_area=cyber_security)
└── Identity & Access (service_area=identity_access)
```

When viewing "Programmatic", you see aggregated qupts from Websites, COMO, Newsletters, and OSINT — each tagged with its origin.

## Database Schema

```sql
-- schema.sql

CREATE TABLE IF NOT EXISTS volitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  parent_id TEXT REFERENCES volitions(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_volitions_parent ON volitions(parent_id);

-- Trigger to update updated_at on volition changes
CREATE TRIGGER IF NOT EXISTS volitions_updated_at
AFTER UPDATE ON volitions
BEGIN
  UPDATE volitions SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS entangled (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('human', 'agent')),
  metadata TEXT,              -- JSON blob
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS volition_entangled (
  volition_id TEXT NOT NULL REFERENCES volitions(id) ON DELETE CASCADE,
  entangled_id TEXT NOT NULL REFERENCES entangled(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('perform', 'accountable', 'control', 'support', 'informed')),
  entangled_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (volition_id, entangled_id, role)
);

CREATE TABLE IF NOT EXISTS qupts (
  id TEXT PRIMARY KEY,
  volition_id TEXT NOT NULL REFERENCES volitions(id) ON DELETE CASCADE,
  entangled_id TEXT REFERENCES entangled(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  source TEXT DEFAULT 'manual',  -- 'manual', 'github', 'gmail', 'zammad', 'gdrive', 'gdocs', 'webhook', 'mcp'
  external_id TEXT,              -- For deduplication: 'github:{id}', 'gmail:{id}', etc.
  metadata TEXT,                 -- JSON blob
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qupts_volition ON qupts(volition_id);
CREATE INDEX IF NOT EXISTS idx_qupts_created ON qupts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qupts_external ON qupts(source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_volition_entangled_volition ON volition_entangled(volition_id);
```

## API Specification

### Volitions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/volitions` | List volitions. Query params: `status`, `function`, `pillar`, `parent_id`, `root_only`, `limit`, `offset` |
| POST | `/api/volitions` | Create volition |
| GET | `/api/volitions/:id` | Get volition with children, matrix, sources, and aggregated qupts |
| PATCH | `/api/volitions/:id` | Update volition |
| DELETE | `/api/volitions/:id` | Delete volition (cascades to children) |

**Create/Update Body:**
```json
{
  "name": "string (required)",
  "description": "string",
  "parent_id": "string (optional, for nesting)"
}
```

**GET Response (single):**
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "parent_id": "string | null",
  "parent": {
    "id": "string",
    "name": "string"
  },
  "created_at": "number",
  "updated_at": "number",
  "attributes": {
    "status": "active",
    "function": "tech_innovation",
    "pillar": "r_and_d"
  },
  "matrix": {
    "perform": [{ "id": "string", "name": "string", "type": "string" }],
    "accountable": [{ "id": "string", "name": "string", "type": "string" }],
    "control": [],
    "support": [],
    "informed": []
  },
  "children": [
    { "id": "string", "name": "string", "attributes": { "status": "active" } }
  ],
  "qupts": [
    { 
      "id": "string", 
      "content": "string", 
      "source": "string", 
      "created_at": "number",
      "volition_id": "string",
      "volition_name": "string"
    }
  ]
}
```

**List Query Parameters:**
- `status=active` — Filter by status attribute
- `function=tech_innovation` — Filter by function
- `pillar=r_and_d` — Filter by pillar
- `parent_id=vol_xxx` — Get children of specific volition
- `root_only=true` — Only top-level volitions (no parent)
- Standard pagination: `limit`, `offset`

### Entangled

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/entangled` | List all entangled. Query params: `type`, `limit`, `offset` |
| POST | `/api/entangled` | Create entangled |
| GET | `/api/entangled/:id` | Get entangled with their volitions and roles |
| PATCH | `/api/entangled/:id` | Update entangled |
| DELETE | `/api/entangled/:id` | Delete entangled |

**Create/Update Body:**
```json
{
  "name": "string (required)",
  "type": "human | agent (required on create)",
  "metadata": {}
}
```

**GET Response (single):**
```json
{
  "id": "string",
  "name": "string",
  "type": "string",
  "metadata": {},
  "created_at": "number",
  "volitions": [
    { 
      "id": "string", 
      "name": "string", 
      "status": "string",
      "roles": ["perform", "support"]
    }
  ]
}
```

### Qupts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/qupts` | List qupts. Query params: `volition_id`, `entangled_id`, `recursive`, `limit`, `offset` |
| POST | `/api/qupts` | Create qupt |
| POST | `/api/qupts/batch` | Create multiple qupts (for bulk import) |
| GET | `/api/qupts/:id` | Get single qupt |
| DELETE | `/api/qupts/:id` | Delete qupt |

**Query Parameters:**
- `volition_id` — Filter to specific volition
- `recursive=true` — Include qupts from child volitions (when volition_id is set)
- `entangled_id` — Filter to specific entangled entity
- `source` — Filter by source type (github, gmail, etc.)
- `limit`, `offset` — Pagination

**Create Body:**
```json
{
  "volition_id": "string (required)",
  "entangled_id": "string",
  "content": "string (required)",
  "source": "string",
  "metadata": {}
}
```

**List Response:**
```json
{
  "qupts": [
    {
      "id": "string",
      "volition_id": "string",
      "volition_name": "string",
      "content": "string",
      "source": "string",
      "metadata": {},
      "created_at": "number"
    }
  ],
  "total": "number",
  "limit": "number",
  "offset": "number"
}
```

### Entanglement (PASCI Matrix)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/volitions/:id/matrix` | Get full PASCI matrix for volition |
| POST | `/api/volitions/:id/matrix` | Assign entangled to role |
| DELETE | `/api/volitions/:id/matrix/:entangled_id/:role` | Remove entangled from role |

**Assign Body:**
```json
{
  "entangled_id": "string (required)",
  "role": "perform | accountable | control | support | informed (required)"
}
```

**Matrix Response:**
```json
{
  "volition_id": "string",
  "matrix": {
    "perform": [{ "id": "string", "name": "string", "type": "string" }],
    "accountable": [{ "id": "string", "name": "string", "type": "string" }],
    "control": [{ "id": "string", "name": "string", "type": "string" }],
    "support": [{ "id": "string", "name": "string", "type": "string" }],
    "informed": [{ "id": "string", "name": "string", "type": "string" }]
  }
}
```

## MCP Interface

Expose as HTTP-based MCP server at `/mcp` endpoint using `@modelcontextprotocol/sdk` and `zod` for schema validation. Implements the official Model Context Protocol specification.

### Tools

#### list_volitions
List all projects/initiatives.
```json
{
  "name": "list_volitions",
  "description": "List volitions in the Zoku system",
  "inputSchema": {
    "type": "object",
    "properties": {
      "status": {
        "type": "string",
        "enum": ["draft", "active", "paused", "complete", "archived"],
        "description": "Filter by status"
      },
      "function": {
        "type": "string",
        "enum": ["tech_innovation", "info_tech"],
        "description": "Filter by function"
      },
      "parent_id": {
        "type": "string",
        "description": "Get children of a specific volition"
      },
      "root_only": {
        "type": "boolean",
        "description": "Only return top-level volitions",
        "default": false
      },
      "limit": {
        "type": "number",
        "description": "Max results to return",
        "default": 20
      }
    }
  }
}
```

#### get_volition
Get details of a specific project.
```json
{
  "name": "get_volition",
  "description": "Get full details of a volition including children, matrix, and aggregated activity from descendants",
  "inputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string", "description": "Volition ID" },
      "include_children_qupts": { 
        "type": "boolean", 
        "description": "Include qupts from child volitions",
        "default": true 
      }
    },
    "required": ["id"]
  }
}
```

#### get_children
Get child volitions of a parent.
```json
{
  "name": "get_children",
  "description": "Get child volitions of a parent volition",
  "inputSchema": {
    "type": "object",
    "properties": {
      "parent_id": { "type": "string", "description": "Parent volition ID" },
      "recursive": { 
        "type": "boolean", 
        "description": "Include all descendants, not just direct children",
        "default": false
      }
    },
    "required": ["parent_id"]
  }
}
```

#### create_volition
Create a new project/initiative.
```json
{
  "name": "create_volition",
  "description": "Create a new project/initiative, optionally as a child of another volition",
  "inputSchema": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "description": "Name of the volition" },
      "description": { "type": "string", "description": "Description of the volition" },
      "parent_id": { "type": "string", "description": "Parent volition ID for nesting" }
    },
    "required": ["name"]
  }
}
```

#### update_volition
Update an existing volition.
```json
{
  "name": "update_volition",
  "description": "Update a volition's name, description, or parent",
  "inputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "name": { "type": "string" },
      "description": { "type": "string" },
      "parent_id": { "type": "string", "description": "Move to new parent (null to make root)" }
    },
    "required": ["id"]
  }
}
```

#### move_volition
Move a volition to a new parent.
```json
{
  "name": "move_volition",
  "description": "Move a volition to become a child of another volition, or make it a root volition",
  "inputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string", "description": "Volition ID to move" },
      "new_parent_id": { 
        "type": "string", 
        "description": "New parent volition ID, or null to make root-level"
      }
    },
    "required": ["id"]
  }
}
```

#### delete_volition
Delete a volition and its descendants.
```json
{
  "name": "delete_volition",
  "description": "Delete a volition. WARNING: Also deletes all child volitions, qupts, sources, and assignments.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string", "description": "Volition ID to delete" },
      "confirm": { 
        "type": "boolean", 
        "description": "Must be true to confirm deletion",
        "default": false
      }
    },
    "required": ["id", "confirm"]
  }
}
```

#### create_qupt
Record activity on a volition.
```json
{
  "name": "create_qupt",
  "description": "Record activity or update on a volition",
  "inputSchema": {
    "type": "object",
    "properties": {
      "volition_id": { "type": "string", "description": "ID of the volition" },
      "content": { "type": "string", "description": "Activity description" },
      "entangled_id": { "type": "string", "description": "ID of the entangled entity creating this qupt" },
      "metadata": { "type": "object", "description": "Additional structured data" }
    },
    "required": ["volition_id", "content"]
  }
}
```

#### list_qupts
Get activity for a volition.
```json
{
  "name": "list_qupts",
  "description": "List activity for a volition, optionally including child volitions",
  "inputSchema": {
    "type": "object",
    "properties": {
      "volition_id": { "type": "string" },
      "recursive": { 
        "type": "boolean", 
        "description": "Include qupts from child volitions",
        "default": true
      },
      "source": { 
        "type": "string", 
        "description": "Filter by source (github, gmail, zammad, etc.)"
      },
      "limit": { "type": "number", "default": 20 }
    },
    "required": ["volition_id"]
  }
}
```

#### list_entangled
List partners/entities.
```json
{
  "name": "list_entangled",
  "description": "List all entangled partners (humans and AI agents)",
  "inputSchema": {
    "type": "object",
    "properties": {
      "type": { "type": "string", "enum": ["human", "agent"] },
      "limit": { "type": "number", "default": 20 }
    }
  }
}
```

#### create_entangled
Create a new partner/entity.
```json
{
  "name": "create_entangled",
  "description": "Register a new entangled partner (human or AI agent)",
  "inputSchema": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "description": "Name of the entity" },
      "type": { "type": "string", "enum": ["human", "agent"] },
      "metadata": { "type": "object", "description": "Additional metadata" }
    },
    "required": ["name", "type"]
  }
}
```

#### get_entangled
Get details of a specific entity.
```json
{
  "name": "get_entangled",
  "description": "Get details of an entangled partner including their volitions and roles",
  "inputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string" }
    },
    "required": ["id"]
  }
}
```

#### entangle
Assign an entity to a PASCI role on a volition.
```json
{
  "name": "entangle",
  "description": "Assign an entangled partner to a PASCI role on a volition",
  "inputSchema": {
    "type": "object",
    "properties": {
      "volition_id": { "type": "string" },
      "entangled_id": { "type": "string" },
      "role": { 
        "type": "string", 
        "enum": ["perform", "accountable", "control", "support", "informed"],
        "description": "PASCI role: Perform (does work), Accountable (answerable), Control (veto power), Support (advisory), Informed (notified)"
      }
    },
    "required": ["volition_id", "entangled_id", "role"]
  }
}
```

#### disentangle
Remove an entity from a role on a volition.
```json
{
  "name": "disentangle",
  "description": "Remove an entangled partner from a PASCI role on a volition",
  "inputSchema": {
    "type": "object",
    "properties": {
      "volition_id": { "type": "string" },
      "entangled_id": { "type": "string" },
      "role": { 
        "type": "string", 
        "enum": ["perform", "accountable", "control", "support", "informed"]
      }
    },
    "required": ["volition_id", "entangled_id", "role"]
  }
}
```

#### get_matrix
Get the PASCI responsibility matrix for a volition.
```json
{
  "name": "get_matrix",
  "description": "Get the PASCI responsibility matrix showing who is assigned to each role",
  "inputSchema": {
    "type": "object",
    "properties": {
      "volition_id": { "type": "string" }
    },
    "required": ["volition_id"]
  }
}
```

## Frontend Requirements

Single-page application served from the worker.

### Views

1. **Dashboard (The Great Game)**
   - Summary stats: active volitions, total qupts today/week
   - Recent activity stream (latest qupts across all volitions, showing origin)
   - Quick-add volition form
   - Grouped view by function → pillar/service_area (matching ecosystem diagram)

2. **Volitions List**
   - Tree view for nested volitions (expand/collapse)
   - Filterable by status and taxonomy attributes
   - Faceted filter sidebar (status, function, pillar, service_area, etc.)
   - Shows name, status, accountable entity, attributes, last activity
   - Click to view detail

3. **Volition Detail**
   - Breadcrumb navigation (parent → child → grandchild)
   - Name, description (editable)
   - Taxonomy attributes picker
     - Status (single select)
     - Function, pillar/service_area (dependent selects)
   - Children list (if any)
     - Quick-add child volition
     - Link to child detail
   - PASCI Matrix display
   - Sources configuration
   - Qupts stream (aggregated from self + descendants)
     - Badge/tag showing originating volition for each qupt
     - Filter to show only direct qupts
   - Add manual qupt form

4. **Entangled List**
   - All partners/entities
   - Filter by type (human/agent)
   - Shows their volitions and roles

5. **PASCI Matrix View (optional standalone)**
   - Grid view: volitions as rows, entangled as columns
   - Cells show role codes (P/A/C/S/I)
   - Quick assignment via cell click

6. **Taxonomy Admin (optional)**
   - Manage dimensions and values
   - Add/edit/reorder values
   - Configure dependencies between dimensions

### Tech Stack
- **React** with Vite for optimal DX and build performance
- **Tailwind CSS** for responsive mobile/desktop UI
- **Tanstack Query** for data fetching and caching
- Dark sci-fi aesthetic with functional, iteration-friendly design

### UI Notes
- Dark theme preferred (fits the sci-fi aesthetic)
- Minimal, functional design
- Real-time not required — refresh or poll for updates

### Frontend Structure
```
frontend/
├── package.json      # Frontend-specific dependencies
├── vite.config.ts    # Vite build configuration
├── tsconfig.json     # Frontend TypeScript config
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── src/
│   ├── main.tsx      # React entry point
│   ├── App.tsx       # Root component
│   ├── api/          # API client and queries
│   ├── components/   # React components
│   ├── hooks/        # Custom hooks
│   ├── types/        # TypeScript types
│   └── styles/       # CSS/Tailwind
└── dist/             # Build output (served by worker)
```

**Build process:**
```bash
cd frontend && npm run build
# Outputs to frontend/dist/, served by worker via wrangler.toml assets config
```

## Configuration Files

### wrangler.toml
```toml
name = "zoku"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "zoku"
database_id = "<DATABASE_ID>"

[assets]
directory = "./frontend/dist"
```

### package.json
```json
{
  "name": "zoku",
  "version": "1.0.0",
  "scripts": {
    "dev": "wrangler dev",
    "dev:frontend": "cd frontend && npm run dev",
    "deploy": "wrangler deploy",
    "db:migrate": "wrangler d1 execute zoku --file=./schema.sql",
    "db:seed": "wrangler d1 execute zoku --file=./seed.sql",
    "db:reset": "npm run db:migrate && npm run db:seed",
    "build:frontend": "cd frontend && npm run build",
    "build": "npm run build:frontend"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "@modelcontextprotocol/sdk": "^0.5.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.0.0",
    "typescript": "^5.0.0",
    "wrangler": "^3.0.0"
  }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src/**/*"]
}
```

## Build Steps

### Phase 0: Repository & Infrastructure Setup
1. Initialize git repository locally
2. Create GitHub repository: `gh repo create ResetNetwork/zoku --public`
3. Push initial commit with spec
4. Create Cloudflare Worker: `wrangler init zoku`
5. Create D1 database: `wrangler d1 create zoku`
6. Generate and set encryption key: `openssl rand -base64 32 | wrangler secret put ENCRYPTION_KEY`
7. Update `wrangler.toml` with database ID

### Phase 1: Project Setup
1. Initialize npm with `package.json`
2. Install backend dependencies: `hono`, `@modelcontextprotocol/sdk`, `zod`, TypeScript types
3. Install frontend dependencies: `vite`, `react`, `@tanstack/react-query`, `tailwindcss`
4. Create `tsconfig.json` for worker and frontend
5. Create `schema.sql` (includes tables + taxonomy seed data) and run migration
6. Verify seed data: dimensions, values, and dependencies
7. **Test build & commit** after each phase

### Phase 2: Core API
1. Create `src/index.ts` — Hono app setup, route mounting, scheduled export
2. Create `src/db.ts` — D1 query helper functions
3. Create `src/lib/crypto.ts` — Credential encryption/decryption helpers
4. Create `src/api/volitions.ts` — CRUD + nested routes for matrix, attributes, sources
5. Create `src/api/entangled.ts` — CRUD routes
6. Create `src/api/qupts.ts` — CRUD routes (including batch endpoint)
7. Create `src/api/sources.ts` — Source operations by ID (update, delete, manual sync)
8. Create `src/api/dimensions.ts` — Taxonomy dimension CRUD
9. Test all endpoints with `wrangler dev`

### Phase 3: Source Handlers (Priority: GitHub, Zammad, Google Docs)
1. Create `src/handlers/index.ts` — Handler interface and registry with error handling
2. Create `src/handlers/google-auth.ts` — Shared Google OAuth token refresh
3. **Priority:** Create `src/handlers/github.ts` — GitHub Events API polling
4. **Priority:** Create `src/handlers/zammad.ts` — Zammad ticket and article polling
5. **Priority:** Create `src/handlers/gdocs.ts` — Google Docs revisions and suggestions
6. Create `src/handlers/gmail.ts` — Gmail API polling (lower priority)
7. Create `src/handlers/gdrive.ts` — Google Drive Changes API polling (lower priority)
8. Create `src/handlers/webhook.ts` — Inbound webhook validation and processing
9. Create `src/scheduled.ts` — Cron trigger handler with error recovery
10. **Test build & commit** after each handler
11. Test with `wrangler dev --test-scheduled`

### Phase 4: MCP Server
1. Install `@modelcontextprotocol/sdk` and `zod`
2. Create `src/mcp/server.ts` implementing official MCP protocol
3. Define all MCP tools with Zod schemas for validation
4. Implement tool handlers connecting to db queries
5. Mount at `/mcp` endpoint (not `/mcp/serve`)
6. **Test build & commit**
7. Test with MCP client (Claude Desktop or similar)

### Phase 5: Frontend
1. Set up Vite + React + Tailwind project in `frontend/`
2. Configure responsive mobile/desktop layout with dark sci-fi theme
3. Implement OAuth flow for Google services (authorization component)
4. Implement dashboard view with ecosystem grouping
5. Implement volitions list with faceted filtering
6. Implement volition detail view with breadcrumb navigation
7. Implement taxonomy attribute picker component (non-enforcing)
8. Implement PASCI matrix component with warnings (not enforcement)
9. Implement entangled list view
10. Implement sources management in volition detail
11. Build with `npm run build`
12. Configure asset serving in wrangler.toml
13. **Test build & commit** after major UI sections

### Phase 6: Deployment
1. Verify Cloudflare Access configuration (already set up per user)
2. Configure Access policy to exclude `/webhook/*` paths
3. Create service token for AI agents/MCP clients via Cloudflare dashboard
4. Deploy with `wrangler deploy`
5. Run production migration: `wrangler d1 execute zoku --file=./schema.sql --remote`
6. Run production seed: `wrangler d1 execute zoku --file=./seed.sql --remote`
7. Configure OAuth credentials for Google services (Google Cloud Console)
8. Test all interfaces (web, MCP, API)
9. **Final commit and push to main**

## Testing Approach

**Recommended: Manual + Integration Testing**
- Manual testing during development with `wrangler dev`
- Integration tests for critical flows (source collection, MCP tools, matrix validation)
- Use `wrangler dev --test-scheduled` for cron testing
- Frontend testing via local dev server
- Pre-deployment smoke tests on staging worker (if available)
- Post-deployment verification of all interfaces

**Automated testing can be added later if needed:**
- Vitest for unit tests (handlers, db queries)
- Playwright for E2E frontend tests
- MCP tool testing via SDK client

## Implementation Plan Summary

### Decisions Made
1. **Framework**: React + Vite for frontend (optimal DX, build performance)
2. **Source Priority**: GitHub, Zammad, Google Docs (then Gmail, Drive)
3. **MCP Implementation**: Official `@modelcontextprotocol/sdk` at `/mcp` endpoint
4. **PASCI Enforcement**: Accountable required (enforced), Perform recommended (warning only)
5. **Taxonomy**: No server-side enforcement, frontend filters available options
6. **Nesting**: Unlimited depth, no restrictions
7. **Error Handling**: Log and continue, retry on next cron, track failures
8. **Testing**: Manual + integration during dev, automated tests optional later
9. **OAuth**: Frontend implements full flow for Google services
10. **Build**: Frequent commits after each phase completion

### Infrastructure Setup
- GitHub repo: `ResetNetwork/zoku` (public)
- Cloudflare Worker via wrangler CLI (already configured with Access)
- D1 database via wrangler
- Encryption key: Generated via `openssl rand -base64 32 | wrangler secret put ENCRYPTION_KEY`

### Key Technical Details
- **MCP Server**: Full Model Context Protocol implementation with Zod schemas
- **Credentials**: AES-GCM encrypted at rest in D1
- **Source Errors**: Log, continue, retry on next cron (5min interval)
- **Frontend**: Responsive mobile/desktop, dark sci-fi theme
- **Deduplication**: `external_id` with unique index `(source, external_id)`
- **Matrix Validation**: Warn on missing Perform, block on missing/multiple Accountable

### Build Sequence
1. **Phase 0**: Repo, worker, database, encryption setup
2. **Phase 1**: Project structure, dependencies, schema
3. **Phase 2**: Core API (volitions, entangled, qupts, dimensions, sources)
4. **Phase 3**: Source handlers (GitHub → Zammad → Docs → Gmail → Drive → Webhook)
5. **Phase 4**: MCP server with official SDK
6. **Phase 5**: React frontend with OAuth flow
7. **Phase 6**: Deploy and configure production

### Commit Strategy
- Commit after each phase completion
- Commit after each source handler implementation
- Commit after major UI sections
- Test build before each commit

## Qupt Sources & Collection

Qupts flow into the system from multiple sources. Each volition can define its sources, and collection happens via Cloudflare Cron Triggers calling source-specific handlers.

### Source Configuration

Add `sources` table and link to volitions:

```sql
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  volition_id TEXT NOT NULL REFERENCES volitions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,           -- 'github', 'gmail', 'zammad', 'gdrive', 'gdocs', 'webhook'
  config TEXT NOT NULL,         -- JSON configuration
  credentials TEXT,             -- JSON encrypted credentials (tokens, etc.)
  enabled INTEGER DEFAULT 1,
  last_sync INTEGER,            -- Last successful sync timestamp
  sync_cursor TEXT,             -- Pagination cursor for incremental sync
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_sources_volition ON sources(volition_id);
CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type);
CREATE INDEX IF NOT EXISTS idx_sources_enabled ON sources(enabled);
```

### Source Types & Config

#### GitHub
```json
{
  "type": "github",
  "config": {
    "owner": "reset-tech",
    "repo": "nova",
    "events": ["push", "pull_request", "issues", "issue_comment"]
  },
  "credentials": {
    "token": "ghp_xxx"
  }
}
```

#### Gmail
```json
{
  "type": "gmail",
  "config": {
    "label": "Projects/NOVA",
    "include_sent": true
  },
  "credentials": {
    "refresh_token": "xxx",
    "client_id": "xxx",
    "client_secret": "xxx"
  }
}
```

#### Generic Webhook (inbound)
```json
{
  "type": "webhook",
  "config": {
    "name": "Slack notifications"
  },
  "credentials": {
    "secret": "webhook_secret_for_validation"
  }
}
```

#### Zammad
```json
{
  "type": "zammad",
  "config": {
    "url": "https://support.example.com",
    "query": "state:open OR state:pending",
    "include_articles": true
  },
  "credentials": {
    "token": "zammad_api_token"
  }
}
```

#### Google Drive (folder activity)
```json
{
  "type": "gdrive",
  "config": {
    "folder_id": "1abc123...",
    "include_subfolders": true,
    "events": ["create", "edit", "delete", "move"]
  },
  "credentials": {
    "refresh_token": "xxx",
    "client_id": "xxx",
    "client_secret": "xxx"
  }
}
```

#### Google Docs (document revisions)
```json
{
  "type": "gdocs",
  "config": {
    "document_id": "1abc123...",
    "track_suggestions": true
  },
  "credentials": {
    "refresh_token": "xxx",
    "client_id": "xxx",
    "client_secret": "xxx"
  }
}
```

### Collection Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 Cloudflare Cron Trigger                         │
│                  (every 5 minutes)                              │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Worker: scheduled()                          │
├─────────────────────────────────────────────────────────────────┤
│  1. Query enabled sources from D1                               │
│  2. Group by type                                               │
│  3. Call handler for each source                                │
│  4. Handlers fetch from external APIs                           │
│  5. Transform to qupts, batch insert                            │
│  6. Update last_sync and sync_cursor                            │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  GitHub API     │  │   Gmail API     │  │  (other APIs)   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### Project Structure Update

```
zoku/
├── src/
│   ├── index.ts              # Worker entry, route mounting
│   ├── scheduled.ts          # Cron trigger handler
│   ├── api/
│   │   ├── volitions.ts
│   │   ├── entangled.ts
│   │   ├── qupts.ts
│   │   └── sources.ts        # Source CRUD
│   ├── handlers/
│   │   ├── index.ts          # Handler registry
│   │   ├── github.ts         # GitHub source handler
│   │   ├── gmail.ts          # Gmail source handler
│   │   ├── zammad.ts         # Zammad source handler
│   │   ├── gdrive.ts         # Google Drive folder handler
│   │   ├── gdocs.ts          # Google Docs revision handler
│   │   ├── google-auth.ts    # Shared Google OAuth helper
│   │   └── webhook.ts        # Inbound webhook handler
│   ├── mcp/
│   │   └── server.ts
│   └── db.ts
├── frontend/
├── schema.sql
├── wrangler.toml
└── package.json
```

### wrangler.toml Cron Configuration

```toml
name = "zoku"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "zoku"
database_id = "<DATABASE_ID>"

[assets]
directory = "./frontend/dist"

[triggers]
crons = ["*/5 * * * *"]  # Every 5 minutes
```

### Worker Entry Point Update

```typescript
// src/index.ts
import { Hono } from 'hono';
import { volitionsRoutes } from './api/volitions';
import { entangledRoutes } from './api/entangled';
import { quptsRoutes } from './api/qupts';
import { sourcesRoutes } from './api/sources';
import { dimensionsRoutes } from './api/dimensions';
import { mcpHandler } from './mcp/server';
import { webhookHandler } from './handlers/webhook';
import { handleScheduled } from './scheduled';

type Bindings = {
  DB: D1Database;
  ENCRYPTION_KEY: string;  // For encrypting source credentials
};

const app = new Hono<{ Bindings: Bindings }>();

// API routes
// Note: Matrix and attribute routes are nested under volitions
app.route('/api/volitions', volitionsRoutes);  // Includes /api/volitions/:id/matrix, /api/volitions/:id/attributes, /api/volitions/:id/sources
app.route('/api/entangled', entangledRoutes);
app.route('/api/qupts', quptsRoutes);
app.route('/api/sources', sourcesRoutes);      // For /api/sources/:id operations
app.route('/api/dimensions', dimensionsRoutes);

// MCP endpoint (HTTP-based MCP server using official SDK)
app.all('/mcp', mcpHandler);

// Inbound webhooks (bypass Access for external services)
app.post('/webhook/:source_id', webhookHandler);

export default {
  fetch: app.fetch,
  scheduled: handleScheduled
};
```

### Scheduled Handler

```typescript
// src/scheduled.ts
import { handlers } from './handlers';
import { decryptCredentials } from './lib/crypto';

type Env = {
  DB: D1Database;
  ENCRYPTION_KEY: string;
};

export async function handleScheduled(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
) {
  // Get all enabled sources
  const sources = await env.DB
    .prepare('SELECT * FROM sources WHERE enabled = 1')
    .all();

  // Process each source
  const results = await Promise.allSettled(
    sources.results.map(async (source) => {
      const handler = handlers[source.type];
      if (!handler) {
        console.warn(`No handler for source type: ${source.type}`);
        return;
      }

      const config = JSON.parse(source.config);
      
      // Decrypt credentials before use
      const credentials = source.credentials 
        ? JSON.parse(await decryptCredentials(source.credentials, env.ENCRYPTION_KEY))
        : {};

      // Fetch new activity
      const { qupts, cursor } = await handler.collect({
        source,
        config,
        credentials,
        since: source.last_sync,
        cursor: source.sync_cursor
      });

      if (qupts.length > 0) {
        // Batch insert qupts with deduplication
        await insertQupts(env.DB, qupts);
      }

      // Update sync state
      await env.DB
        .prepare('UPDATE sources SET last_sync = ?, sync_cursor = ? WHERE id = ?')
        .bind(Math.floor(Date.now() / 1000), cursor, source.id)
        .run();

      return { source_id: source.id, count: qupts.length };
    })
  );

  console.log('Sync complete:', results);
}

async function insertQupts(db: D1Database, qupts: QuptInput[]) {
  // Use INSERT OR IGNORE for deduplication via external_id
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO qupts (id, volition_id, entangled_id, content, source, external_id, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const batch = qupts.map(q => stmt.bind(
    crypto.randomUUID(),
    q.volition_id,
    q.entangled_id || null,
    q.content,
    q.source,
    q.external_id || null,
    q.metadata ? JSON.stringify(q.metadata) : null,
    q.created_at || Math.floor(Date.now() / 1000)
  ));
  
  await db.batch(batch);
}
```

### Handler Interface

```typescript
// src/handlers/index.ts
import { githubHandler } from './github';
import { gmailHandler } from './gmail';
import { zammadHandler } from './zammad';
import { gdriveHandler } from './gdrive';
import { gdocsHandler } from './gdocs';

export interface SourceHandler {
  collect(params: {
    source: Source;
    config: Record<string, any>;
    credentials: Record<string, any>;
    since: number | null;
    cursor: string | null;
  }): Promise<{
    qupts: QuptInput[];
    cursor: string | null;
  }>;
}

export const handlers: Record<string, SourceHandler> = {
  github: githubHandler,
  gmail: gmailHandler,
  zammad: zammadHandler,
  gdrive: gdriveHandler,
  gdocs: gdocsHandler
};
```

### GitHub Handler

```typescript
// src/handlers/github.ts
import { SourceHandler } from './index';

export const githubHandler: SourceHandler = {
  async collect({ source, config, credentials, since }) {
    const { owner, repo, events } = config;
    const { token } = credentials;

    const qupts = [];

    // Fetch recent events from GitHub API
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/events?per_page=100`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'Zoku/1.0'
        }
      }
    );

    const ghEvents = await response.json();

    for (const event of ghEvents) {
      const eventTime = new Date(event.created_at).getTime() / 1000;

      // Skip if before last sync
      if (since && eventTime <= since) continue;

      // Skip if not in configured events
      const eventType = mapEventType(event.type);
      if (!events.includes(eventType)) continue;

      qupts.push({
        volition_id: source.volition_id,
        content: formatEventContent(event),
        source: 'github',
        external_id: `github:${event.id}`,
        metadata: {
          event_type: event.type,
          actor: event.actor?.login,
          repo: `${owner}/${repo}`,
          payload: event.payload,
          url: getEventUrl(event)
        },
        created_at: eventTime
      });
    }

    return { qupts, cursor: null };
  }
};

function mapEventType(ghType: string): string {
  const map = {
    'PushEvent': 'push',
    'PullRequestEvent': 'pull_request',
    'IssuesEvent': 'issues',
    'IssueCommentEvent': 'issue_comment'
  };
  return map[ghType] || ghType.toLowerCase();
}

function formatEventContent(event: any): string {
  switch (event.type) {
    case 'PushEvent':
      const count = event.payload.commits?.length || 0;
      return `${count} commit(s) pushed by @${event.actor.login}`;
    case 'PullRequestEvent':
      return `PR #${event.payload.pull_request.number} ${event.payload.action}: ${event.payload.pull_request.title}`;
    case 'IssuesEvent':
      return `Issue #${event.payload.issue.number} ${event.payload.action}: ${event.payload.issue.title}`;
    case 'IssueCommentEvent':
      return `Comment on #${event.payload.issue.number} by @${event.actor.login}`;
    default:
      return `${event.type} by @${event.actor.login}`;
  }
}
```

### Gmail Handler

```typescript
// src/handlers/gmail.ts
import { SourceHandler } from './index';
import { refreshGoogleAccessToken } from './google-auth';

export const gmailHandler: SourceHandler = {
  async collect({ source, config, credentials, since, cursor }) {
    const { label, include_sent } = config;

    // Get access token (refresh if needed)
    const accessToken = await refreshGoogleAccessToken(credentials);

    // Build query
    let query = `label:${label}`;
    if (since) {
      const sinceDate = new Date(since * 1000).toISOString().split('T')[0];
      query += ` after:${sinceDate}`;
    }

    // Fetch messages
    const listResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50${cursor ? `&pageToken=${cursor}` : ''}`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    const listData = await listResponse.json();
    const qupts = [];

    for (const msg of listData.messages || []) {
      // Fetch full message
      const msgResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );

      const msgData = await msgResponse.json();
      const headers = parseHeaders(msgData.payload.headers);

      qupts.push({
        volition_id: source.volition_id,
        content: `Email from ${headers.from}: ${headers.subject}`,
        source: 'gmail',
        external_id: `gmail:${msg.id}`,
        metadata: {
          message_id: msg.id,
          thread_id: msg.threadId,
          from: headers.from,
          to: headers.to,
          subject: headers.subject,
          snippet: msgData.snippet,
          label
        },
        created_at: parseInt(msgData.internalDate) / 1000
      });
    }

    return {
      qupts,
      cursor: listData.nextPageToken || null
    };
  }
};

function parseHeaders(headers: any[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const h of headers) {
    result[h.name.toLowerCase()] = h.value;
  }
  return result;
}
```

### Zammad Handler

```typescript
// src/handlers/zammad.ts
import { SourceHandler } from './index';

export const zammadHandler: SourceHandler = {
  async collect({ source, config, credentials, since, cursor }) {
    const { url, query, include_articles } = config;
    const { token } = credentials;

    const headers = {
      'Authorization': `Token token=${token}`,
      'Content-Type': 'application/json'
    };

    const qupts = [];

    // Parse cursor for pagination
    const page = cursor ? parseInt(cursor) : 1;
    const perPage = 50;

    // Build search query with time filter
    let searchQuery = query || '';
    if (since) {
      const sinceDate = new Date(since * 1000).toISOString();
      searchQuery += ` updated_at:>=${sinceDate}`;
    }

    // Search for tickets
    const searchResponse = await fetch(
      `${url}/api/v1/tickets/search?query=${encodeURIComponent(searchQuery)}&page=${page}&per_page=${perPage}&sort_by=updated_at&order_by=asc`,
      { headers }
    );

    const searchData = await searchResponse.json();
    const tickets = searchData.assets?.Ticket || {};
    const ticketIds = Object.keys(tickets);

    for (const ticketId of ticketIds) {
      const ticket = tickets[ticketId];
      const ticketTime = new Date(ticket.updated_at).getTime() / 1000;

      // Create qupt for ticket update
      qupts.push({
        volition_id: source.volition_id,
        content: formatTicketContent(ticket),
        source: 'zammad',
        external_id: `zammad:ticket:${ticket.id}:${ticket.updated_at}`,
        metadata: {
          type: 'ticket',
          ticket_id: ticket.id,
          ticket_number: ticket.number,
          title: ticket.title,
          state: ticket.state,
          priority: ticket.priority,
          group: ticket.group,
          owner: ticket.owner,
          customer: ticket.customer,
          url: `${url}/#ticket/zoom/${ticket.id}`
        },
        created_at: ticketTime
      });

      // Fetch articles (comments/replies) if configured
      if (include_articles) {
        const articlesResponse = await fetch(
          `${url}/api/v1/ticket_articles/by_ticket/${ticketId}`,
          { headers }
        );

        const articles = await articlesResponse.json();

        for (const article of articles) {
          const articleTime = new Date(article.created_at).getTime() / 1000;

          // Skip articles before last sync
          if (since && articleTime <= since) continue;

          qupts.push({
            volition_id: source.volition_id,
            content: formatArticleContent(article, ticket),
            source: 'zammad',
            external_id: `zammad:article:${article.id}`,
            metadata: {
              type: 'article',
              article_id: article.id,
              ticket_id: ticket.id,
              ticket_number: ticket.number,
              ticket_title: ticket.title,
              from: article.from,
              to: article.to,
              subject: article.subject,
              article_type: article.type,
              internal: article.internal,
              sender: article.sender,
              url: `${url}/#ticket/zoom/${ticket.id}`
            },
            created_at: articleTime
          });
        }
      }
    }

    // Determine next cursor
    const hasMore = ticketIds.length === perPage;
    const nextCursor = hasMore ? String(page + 1) : null;

    return { qupts, cursor: nextCursor };
  }
};

function formatTicketContent(ticket: any): string {
  const state = ticket.state || 'unknown';
  return `Ticket #${ticket.number} [${state}]: ${ticket.title}`;
}

function formatArticleContent(article: any, ticket: any): string {
  const sender = article.from || article.sender || 'Unknown';
  const type = article.type || 'note';
  const internal = article.internal ? ' (internal)' : '';
  return `${type}${internal} on #${ticket.number} from ${sender}`;
}
```

### Google Drive Handler

```typescript
// src/handlers/gdrive.ts
import { SourceHandler } from './index';
import { refreshGoogleAccessToken } from './google-auth';

export const gdriveHandler: SourceHandler = {
  async collect({ source, config, credentials, cursor }) {
    const { folder_id, include_subfolders, events } = config;
    const accessToken = await refreshGoogleAccessToken(credentials);

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    const qupts = [];

    // Use Drive Changes API for efficient incremental sync
    // Get start page token if no cursor exists
    let pageToken = cursor;
    if (!pageToken) {
      const startResponse = await fetch(
        'https://www.googleapis.com/drive/v3/changes/startPageToken',
        { headers }
      );
      const startData = await startResponse.json();
      // Return early with just the token on first run
      return { qupts: [], cursor: startData.startPageToken };
    }

    // Fetch changes since last sync
    const changesResponse = await fetch(
      `https://www.googleapis.com/drive/v3/changes?pageToken=${pageToken}&fields=nextPageToken,newStartPageToken,changes(changeType,removed,fileId,file(id,name,mimeType,parents,modifiedTime,lastModifyingUser,trashed,trashedTime))&includeRemoved=true&pageSize=100`,
      { headers }
    );

    const changesData = await changesResponse.json();

    for (const change of changesData.changes || []) {
      const file = change.file;

      // Skip if not in target folder (or subfolder if enabled)
      if (file && !await isInFolder(accessToken, file, folder_id, include_subfolders)) {
        continue;
      }

      const eventType = determineEventType(change);
      if (!events.includes(eventType)) continue;

      const changeTime = file?.modifiedTime
        ? new Date(file.modifiedTime).getTime() / 1000
        : Date.now() / 1000;

      qupts.push({
        volition_id: source.volition_id,
        content: formatDriveContent(change, eventType),
        source: 'gdrive',
        external_id: `gdrive:${change.fileId}:${changeTime}`,
        metadata: {
          event_type: eventType,
          file_id: change.fileId,
          file_name: file?.name,
          mime_type: file?.mimeType,
          modified_by: file?.lastModifyingUser?.displayName,
          modified_by_email: file?.lastModifyingUser?.emailAddress,
          folder_id,
          trashed: file?.trashed,
          url: file ? `https://drive.google.com/file/d/${file.id}` : null
        },
        created_at: changeTime
      });
    }

    // Use newStartPageToken for next sync, or nextPageToken if more pages
    const nextCursor = changesData.newStartPageToken || changesData.nextPageToken;

    return { qupts, cursor: nextCursor };
  }
};

async function isInFolder(
  accessToken: string,
  file: any,
  targetFolderId: string,
  includeSubfolders: boolean
): Promise<boolean> {
  if (!file.parents) return false;

  // Direct child of target folder
  if (file.parents.includes(targetFolderId)) return true;

  if (!includeSubfolders) return false;

  // Check parent chain for subfolders
  for (const parentId of file.parents) {
    const parentResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${parentId}?fields=parents`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const parent = await parentResponse.json();

    if (parent.parents?.includes(targetFolderId)) return true;
    // Note: For deep nesting, would need recursive check
  }

  return false;
}

function determineEventType(change: any): string {
  if (change.removed || change.file?.trashed) return 'delete';
  // Drive Changes API doesn't distinguish create vs edit reliably
  // Would need to compare with known files or check createdTime
  return 'edit';
}

function formatDriveContent(change: any, eventType: string): string {
  const file = change.file;
  if (!file) return `File ${change.fileId} was ${eventType}d`;

  const user = file.lastModifyingUser?.displayName || 'Someone';
  const action = eventType === 'delete' ? 'deleted' : 'modified';

  return `${user} ${action} "${file.name}"`;
}
```

### Google Docs Handler

```typescript
// src/handlers/gdocs.ts
import { SourceHandler } from './index';
import { refreshGoogleAccessToken } from './google-auth';

export const gdocsHandler: SourceHandler = {
  async collect({ source, config, credentials, since, cursor }) {
    const { document_id, track_suggestions } = config;
    const accessToken = await refreshGoogleAccessToken(credentials);

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    const qupts = [];

    // Get document metadata for title
    const docResponse = await fetch(
      `https://docs.googleapis.com/v1/documents/${document_id}?fields=title`,
      { headers }
    );
    const doc = await docResponse.json();
    const docTitle = doc.title;

    // Fetch revisions
    const revisionsResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${document_id}/revisions?fields=revisions(id,modifiedTime,lastModifyingUser)&pageSize=100`,
      { headers }
    );

    const revisionsData = await revisionsResponse.json();
    const lastProcessedId = cursor ? parseInt(cursor) : 0;

    for (const revision of revisionsData.revisions || []) {
      const revisionId = parseInt(revision.id);
      const revisionTime = new Date(revision.modifiedTime).getTime() / 1000;

      // Skip already processed revisions
      if (revisionId <= lastProcessedId) continue;

      // Skip if before last sync time
      if (since && revisionTime <= since) continue;

      qupts.push({
        volition_id: source.volition_id,
        content: formatRevisionContent(revision, docTitle),
        source: 'gdocs',
        external_id: `gdocs:${document_id}:rev:${revision.id}`,
        metadata: {
          type: 'revision',
          document_id,
          document_title: docTitle,
          revision_id: revision.id,
          modified_by: revision.lastModifyingUser?.displayName,
          modified_by_email: revision.lastModifyingUser?.emailAddress,
          url: `https://docs.google.com/document/d/${document_id}/edit`
        },
        created_at: revisionTime
      });
    }

    // Track suggestions if enabled
    if (track_suggestions) {
      const suggestionsQupts = await collectSuggestions(
        accessToken,
        source.volition_id,
        document_id,
        docTitle,
        since
      );
      qupts.push(...suggestionsQupts);
    }

    // Use highest revision ID as cursor
    const maxRevisionId = revisionsData.revisions?.length
      ? Math.max(...revisionsData.revisions.map((r: any) => parseInt(r.id)))
      : lastProcessedId;

    return { qupts, cursor: String(maxRevisionId) };
  }
};

async function collectSuggestions(
  accessToken: string,
  volitionId: string,
  documentId: string,
  docTitle: string,
  since: number | null
): Promise<any[]> {
  // Fetch document with suggestions
  const response = await fetch(
    `https://docs.googleapis.com/v1/documents/${documentId}?suggestionsViewMode=SUGGESTIONS_INLINE`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );

  const doc = await response.json();
  const qupts = [];

  // Extract suggestions from document content
  // Suggestions are embedded in the document body with suggestedInsertionIds/suggestedDeletionIds
  const suggestions = extractSuggestions(doc);

  for (const suggestion of suggestions) {
    // Note: Suggestions don't have reliable timestamps, using current time
    const suggestionTime = Date.now() / 1000;

    qupts.push({
      volition_id: volitionId,
      content: `Suggestion in "${docTitle}": ${suggestion.preview}`,
      source: 'gdocs',
      external_id: `gdocs:${documentId}:suggestion:${suggestion.id}`,
      metadata: {
        type: 'suggestion',
        document_id: documentId,
        document_title: docTitle,
        suggestion_id: suggestion.id,
        suggestion_type: suggestion.type,
        author: suggestion.author,
        preview: suggestion.preview,
        url: `https://docs.google.com/document/d/${documentId}/edit`
      },
      created_at: suggestionTime
    });
  }

  return qupts;
}

function extractSuggestions(doc: any): any[] {
  const suggestions: any[] = [];
  const suggestedChanges = doc.suggestedDocumentStyleChanges || {};

  // Also check body content for inline suggestions
  // This is simplified - full implementation would walk the document tree
  for (const [suggestionId, change] of Object.entries(suggestedChanges)) {
    suggestions.push({
      id: suggestionId,
      type: 'style',
      preview: 'Document style change',
      author: (change as any).suggestionsViewMode?.suggestedTextStyleChanges?.author
    });
  }

  return suggestions;
}

function formatRevisionContent(revision: any, docTitle: string): string {
  const user = revision.lastModifyingUser?.displayName || 'Someone';
  return `${user} edited "${docTitle}"`;
}
```

### Google Auth Helper

```typescript
// src/handlers/google-auth.ts

export async function refreshGoogleAccessToken(credentials: any): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      refresh_token: credentials.refresh_token,
      grant_type: 'refresh_token'
    })
  });

  const data = await response.json();

  if (!data.access_token) {
    throw new Error(`Google OAuth error: ${data.error_description || data.error}`);
  }

  return data.access_token;
}
```
```

### API Additions

#### Sources CRUD

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/volitions/:id/sources` | List sources for a volition |
| POST | `/api/volitions/:id/sources` | Add source to volition |
| GET | `/api/sources/:id` | Get source details |
| PATCH | `/api/sources/:id` | Update source config |
| DELETE | `/api/sources/:id` | Remove source |
| POST | `/api/sources/:id/sync` | Trigger manual sync |

#### Bulk Qupt Ingestion

For batch imports and webhook handlers:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/qupts/batch` | Create multiple qupts |

**Batch Body:**
```json
{
  "qupts": [
    {
      "volition_id": "string",
      "entangled_id": "string (optional)",
      "content": "string",
      "source": "string",
      "external_id": "string (optional, for dedup)",
      "metadata": {},
      "created_at": "number (optional, for backdating)"
    }
  ]
}
```

#### Inbound Webhooks

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhook/:source_id` | Receive webhook from external service |

This endpoint should be excluded from Cloudflare Access (allow external services to POST). Validation via webhook secret in source credentials.

### Deduplication

Qupts include `external_id` for deduplication (defined in main schema).

Format by source:
- GitHub: `github:{event_id}`
- Gmail: `gmail:{message_id}`
- Zammad: `zammad:ticket:{ticket_id}:{updated_at}` or `zammad:article:{article_id}`
- Google Drive: `gdrive:{file_id}:{modified_time}`
- Google Docs: `gdocs:{document_id}:rev:{revision_id}` or `gdocs:{document_id}:suggestion:{suggestion_id}`
- Webhook: `webhook:{source_id}:{payload_hash}`

Insert uses `INSERT OR IGNORE` to skip duplicates based on the unique index on `(source, external_id)`.

### MCP Tools for Sources

#### list_sources
```json
{
  "name": "list_sources",
  "description": "List activity sources configured for a volition",
  "inputSchema": {
    "type": "object",
    "properties": {
      "volition_id": { "type": "string" }
    },
    "required": ["volition_id"]
  }
}
```

#### add_source
```json
{
  "name": "add_source",
  "description": "Add an activity source to a volition (GitHub repo, Gmail label, Zammad tickets, Google Drive folder, Google Doc, etc.)",
  "inputSchema": {
    "type": "object",
    "properties": {
      "volition_id": { "type": "string" },
      "type": { "type": "string", "enum": ["github", "gmail", "zammad", "gdrive", "gdocs", "webhook"] },
      "config": { "type": "object" }
    },
    "required": ["volition_id", "type", "config"]
  }
}
```

#### sync_source
```json
{
  "name": "sync_source",
  "description": "Manually trigger a sync for a source",
  "inputSchema": {
    "type": "object",
    "properties": {
      "source_id": { "type": "string" }
    },
    "required": ["source_id"]
  }
}
```

#### remove_source
```json
{
  "name": "remove_source",
  "description": "Remove an activity source from a volition",
  "inputSchema": {
    "type": "object",
    "properties": {
      "source_id": { "type": "string" }
    },
    "required": ["source_id"]
  }
}
```

#### toggle_source
```json
{
  "name": "toggle_source",
  "description": "Enable or disable a source",
  "inputSchema": {
    "type": "object",
    "properties": {
      "source_id": { "type": "string" },
      "enabled": { "type": "boolean" }
    },
    "required": ["source_id", "enabled"]
  }
}
```

## Authentication Notes

Cloudflare Access handles all authentication:
- **Humans**: Configure identity provider (Google, GitHub, etc.)
- **AI agents/MCP**: Use service tokens
- **Inbound webhooks**: Excluded from Access, validated via webhook secret
- Worker receives `CF-Access-JWT-Assertion` header
- No auth logic needed in worker code — Access blocks unauthenticated requests

### Webhook Bypass

Configure Access to exclude `/webhook/*` paths. These endpoints validate requests using the secret stored in the source credentials:

```typescript
// src/handlers/webhook.ts
import { timingSafeEqual } from 'node:crypto';

export async function webhookHandler(c: Context) {
  const sourceId = c.req.param('source_id');
  const source = await getSource(c.env.DB, sourceId);
  
  if (!source) return c.json({ error: 'Source not found' }, 404);
  
  const credentials = JSON.parse(source.credentials);
  const signature = c.req.header('X-Webhook-Signature');
  
  // Validate signature
  const body = await c.req.text();
  const expected = await computeHmac(credentials.secret, body);
  
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return c.json({ error: 'Invalid signature' }, 401);
  }
  
  // Process webhook payload...
}
```

## ID Generation

Use `crypto.randomUUID()` for all entity IDs. Available in Workers runtime.

## Error Handling

All API routes should return consistent error format:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Volition not found"
  }
}
```

HTTP status codes: 200 (success), 201 (created), 400 (bad request), 404 (not found), 500 (server error)

### PASCI Validation Errors

Matrix assignment should validate:
```json
{
  "error": {
    "code": "MATRIX_INVALID",
    "message": "Volition must have exactly one Accountable"
  }
}
```

- `MATRIX_NO_ACCOUNTABLE` — Attempting to remove the only Accountable
- `MATRIX_MULTIPLE_ACCOUNTABLE` — Attempting to add second Accountable (warn, allow)
- `MATRIX_DUPLICATE` — Entity already has this role on this volition

### Nesting Validation Errors

Volition parent assignment should validate:
```json
{
  "error": {
    "code": "CIRCULAR_REFERENCE",
    "message": "Cannot set parent: would create circular reference"
  }
}
```

- `CIRCULAR_REFERENCE` — Attempting to set parent to self or a descendant
- `PARENT_NOT_FOUND` — Parent volition doesn't exist

**Circular Reference Check:**
```sql
-- Before setting parent_id, verify new_parent is not a descendant
WITH RECURSIVE descendants AS (
  SELECT id FROM volitions WHERE id = :volition_id
  UNION ALL
  SELECT v.id FROM volitions v
  JOIN descendants d ON v.parent_id = d.id
)
SELECT 1 FROM descendants WHERE id = :new_parent_id;
-- If returns a row, reject the update
```

## Security Considerations

### Credential Storage

Source credentials (API tokens, OAuth secrets) are sensitive and must be encrypted at rest.

**Encryption approach:**
```typescript
// src/lib/crypto.ts
export async function encryptCredentials(
  plaintext: string,
  key: string
): Promise<string> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    'AES-GCM',
    false,
    ['encrypt']
  );
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoder.encode(plaintext)
  );
  
  // Return iv + ciphertext as base64
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptCredentials(
  encrypted: string,
  key: string
): Promise<string> {
  const decoder = new TextDecoder();
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    'AES-GCM',
    false,
    ['decrypt']
  );
  
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ciphertext
  );
  
  return decoder.decode(plaintext);
}
```

**wrangler.toml secrets:**
```toml
# Set via: wrangler secret put ENCRYPTION_KEY
# Generate with: openssl rand -base64 32
```

**Usage in handlers:**
```typescript
// In scheduled handler, decrypt before use
const credentials = JSON.parse(
  await decryptCredentials(source.credentials, env.ENCRYPTION_KEY)
);
```

**Error Handling in Source Collection:**
When a source sync fails (API down, token expired, rate limit), the handler should:
- Log the error with details (source_id, type, error message)
- Continue processing other sources
- Leave `last_sync` unchanged (will retry on next cron trigger)
- Optionally: Track consecutive failures and disable source after N failures
