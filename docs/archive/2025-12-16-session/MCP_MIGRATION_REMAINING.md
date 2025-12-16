# MCP Migration - Remaining Work

**Status**: REST API migrated ✅, MCP tools need migration ⏳

## What's Done

### ✅ Phase 1: Services Created
All 6 service classes created with full business logic:
- `src/services/base.ts` - Base class with validation, authorization, audit logging
- `src/services/entanglements.ts` - 13 methods
- `src/services/zoku.ts` - 6 methods
- `src/services/qupts.ts` - 5 methods
- `src/services/jewels.ts` - 6 methods
- `src/services/sources.ts` - 5 methods

### ✅ Phase 2: REST API Migrated
All REST routes converted to use services:
- `src/api/entanglements.ts` - 630 lines → 145 lines (77% reduction!)
- `src/api/zoku.ts` - Thin wrapper around ZokuService
- `src/api/qupts.ts` - Thin wrapper around QuptService
- `src/api/jewels.ts` - Thin wrapper around JewelService
- `src/api/sources.ts` - Thin wrapper around SourceService

Build passes with no TypeScript errors ✅

## What Remains

### ⏳ Phase 3: MCP Tools Migration

**File**: `src/mcp/server.ts` (1604 lines)

**Current Structure**:
- Lines 1-250: Schemas and helper functions
- Lines 251-1550: 29 tool registrations (each ~40-50 lines of business logic)
- Lines 1551-1604: HTTP handler

**Goal**: Replace all DB calls with service calls

**Pattern** (for each tool):

**BEFORE** (current):
```typescript
server.registerTool('create_entanglement', {...}, async (args, extra) => {
  requireMcpTier(user, 'entangled');  // Manual tier check
  const toolLogger = logger.child({...});
  const startTime = Date.now();
  
  try {
    // Validation
    if (!args.name) throw new Error('Name required');
    
    // Business logic
    if (args.parent_id) {
      const parent = await db.getEntanglement(args.parent_id);
      if (!parent) throw new Error('Parent not found');
    }
    
    // Create
    const entanglement = await db.createEntanglement({...});
    
    // Assign PASCI
    if (args.initial_zoku) {
      for (const assignment of args.initial_zoku) {
        await db.assignToMatrix(...);
      }
    }
    
    toolLogger.info('Tool completed', {duration_ms: Date.now() - startTime});
    return {content: [{type: 'text', text: JSON.stringify(entanglement, null, 2)}]};
  } catch (error) {
    toolLogger.error('Tool failed', error);
    throw error;
  }
});
```

**AFTER** (using services):
```typescript
server.registerTool('create_entanglement', {...}, async (args, extra) => {
  return mcpToolWrapper('create_entanglement', logger, extra.sessionId, async () => {
    const result = await services.entanglements.create(args);
    return result;  // mcpToolWrapper handles formatting
  });
});
```

**Reduction**: ~40 lines → ~5 lines per tool = 87% reduction!

## Migration Steps

### 1. Update Helper (Already Created)
✅ Created `src/mcp/mcp-helpers.ts` with:
- `createServices()` - Creates all service instances
- `mcpToolWrapper()` - Handles logging and formatting

### 2. Update Server File

**A. Keep schemas section** (lines 1-200):
```typescript
// Tool schemas using Zod
const schemas = {
  list_entanglements: z.object({...}),
  // ... all 29 schemas (keep as-is)
};
```

**B. Replace `createMcpServer()` function** (lines 251-1550):

```typescript
function createMcpServer(db: DB, env: Env, logger: Logger, user: any): McpServer {
  const server = new McpServer({name: 'zoku', version: '1.0.0'}, {...});
  
  // Create services once
  const services = createServices(db, user, logger, env);
  
  // Register all 29 tools (using generated code)
  
  // Entanglement tools (13)
  server.registerTool('list_entanglements', {...}, async (args, extra) => {
    return mcpToolWrapper('list_entanglements', logger, extra.sessionId, async () => {
      return await services.entanglements.list(args);
    });
  });
  
  server.registerTool('get_entanglement', {...}, async (args, extra) => {
    return mcpToolWrapper('get_entanglement', logger, extra.sessionId, async () => {
      return await services.entanglements.get(
        args.id,
        args.include_children_qupts,
        args.detailed ? 50 : 20
      );
    });
  });
  
  // ... repeat for all 29 tools (use generated code from migration script)
  
  return server;
}
```

**C. Keep HTTP handler** (lines 1551-1604):
```typescript
export function handleMcpRequest(c: Context<{ Bindings: Bindings }>) {
  // ... (keep as-is, just update createMcpServer call to pass env)
  const server = createMcpServer(db, c.env, logger, user);
}
```

### 3. Tool Mappings

Use the Python script output (`scripts/migrate-mcp-to-services.py`) which generates all 29 tools.

**Tools by service**:

**EntanglementService** (12 tools):
- list_entanglements
- get_entanglement
- get_child_entanglements
- create_entanglement
- update_entanglement
- move_entanglement
- delete_entanglement
- get_matrix
- entangle (assignToMatrix)
- disentangle (removeFromMatrix)
- get_attributes
- list_sources

**ZokuService** (3 tools):
- list_zoku
- create_zoku
- get_entangled (get)

**QuptService** (2 tools):
- list_qupts
- create_qupt

**JewelService** (6 tools):
- add_jewel (create)
- list_jewels
- get_jewel
- update_jewel
- delete_jewel
- get_jewel_usage

**SourceService** (4 tools):
- add_source (create)
- sync_source
- remove_source (delete)
- toggle_source (update)

**Not migrated** (2 tools - special cases):
- list_dimensions - Read-only, no service needed
- set_attributes - Complex, needs custom handling

### 4. Special Cases

**list_dimensions**:
```typescript
server.registerTool('list_dimensions', {...}, async (args, extra) => {
  return mcpToolWrapper('list_dimensions', logger, extra.sessionId, async () => {
    const dimensions = await db.listDimensions();
    const values = await db.getAllDimensionValues();
    return {dimensions, values};
  });
});
```

**set_attributes** (needs dimension name → ID conversion):
```typescript
server.registerTool('set_attributes', {...}, async (args, extra) => {
  return mcpToolWrapper('set_attributes', logger, extra.sessionId, async () => {
    // Convert dimension names to IDs
    const dimensions = await db.listDimensions();
    const dimensionValues = await db.getAllDimensionValues();
    
    const attributesToSet = [];
    for (const attr of args.attributes) {
      const dimension = dimensions.find(d => d.name === attr.dimension);
      if (!dimension) throw new Error(`Unknown dimension: ${attr.dimension}`);
      
      const value = dimensionValues.find(v => 
        v.dimension_id === dimension.id && v.value === attr.value
      );
      if (!value) throw new Error(`Unknown value: ${attr.value}`);
      
      attributesToSet.push({dimension_id: dimension.id, value_id: value.id});
    }
    
    await db.setEntanglementAttributes(args.entanglement_id, attributesToSet);
    return {success: true};
  });
});
```

## Testing Checklist

After migration, test each tool type:

### Entanglement Tools
- [ ] list_entanglements
- [ ] get_entanglement
- [ ] create_entanglement (test tier check)
- [ ] update_entanglement (test tier check)
- [ ] delete_entanglement (test tier check + confirm param)
- [ ] PASCI matrix operations

### Zoku Tools
- [ ] list_zoku
- [ ] create_zoku (test tier check)
- [ ] get_entangled

### Qupt Tools
- [ ] list_qupts
- [ ] create_qupt (test tier check)

### Jewel Tools
- [ ] add_jewel (test validation)
- [ ] list_jewels (test ownership filter)
- [ ] update_jewel (test ownership check)
- [ ] delete_jewel (test "in use" check)

### Source Tools
- [ ] add_source (test tier check + jewel ownership)
- [ ] sync_source
- [ ] remove_source

## Expected Results

**Before**:
- REST API: 2400 lines (validation + business logic)
- MCP tools: 1200 lines (validation + business logic)
- **Total: 3600 lines with duplication**

**After**:
- Services: 1200 lines (validation + business logic)
- REST API: 300 lines (thin wrappers)
- MCP tools: 300 lines (thin wrappers)
- **Total: 1800 lines, zero duplication**

**Savings**: 50% reduction (1800 lines removed)

## Commands

```bash
# Backup current MCP server
cp src/mcp/server.ts src/mcp/server.old.ts

# Generate tool registrations
python3 scripts/migrate-mcp-to-services.py > /tmp/mcp-tools.ts

# Manually integrate into src/mcp/server.ts

# Test build
npm run build

# Test MCP locally
# (start dev server, connect MCP client, test tools)

# Commit when all tests pass
git add -A
git commit -m "Complete service layer migration: Migrate MCP tools"
```

## Notes

- ✅ All services handle validation (Zod schemas)
- ✅ All services handle tier checks (BaseService.requireTier)
- ✅ All services handle audit logging
- ✅ mcpToolWrapper handles logging and MCP response formatting
- ⚠️ Special cases (list_dimensions, set_attributes) need manual handling
- ⚠️ Test each tool type after migration to ensure behavior unchanged

---

**Status**: Ready to migrate MCP tools
**Estimated time**: 2-3 hours (careful testing required)
**Risk**: Medium (large file, many tools, but pattern is clear)
