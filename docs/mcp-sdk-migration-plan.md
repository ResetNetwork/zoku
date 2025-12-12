# MCP SDK Migration Plan: DIY Implementation → Official TypeScript SDK

## Executive Summary

**Current State**: The Zoku project imports `@modelcontextprotocol/sdk` (v0.5.0) but uses a custom DIY implementation that manually handles JSON-RPC 2.0 protocol over HTTP.

**Target State**: Replace DIY implementation with official SDK's `StreamableHTTPServerTransport` and `McpServer` classes.

**Approach**: Rip and replace. No phased rollout, no backwards compatibility needed. Not deployed yet, no users.

**Impact**: Replace `src/mcp/server.ts` (~1283 lines) with SDK-based implementation. No database or frontend changes required.

**Timeline**: 3-5 hours (upgrade → replace → test)

---

## 1. Current Implementation Analysis

### 1.1 What's Currently Implemented

File: `src/mcp/server.ts`

**Imports from Official SDK (unused)**:
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
```

**DIY Implementation**:
- Manual JSON-RPC 2.0 protocol handling in `mcpHandler(c: Context)`
- Custom HTTP request/response construction
- Manual handling of `initialize`, `tools/list`, `tools/call` methods
- 29 MCP tools with Zod validation schemas
- Direct integration with Hono framework
- Custom logging with request correlation

**Endpoint**: `POST /mcp` (HTTP-based, not stdio)

### 1.2 Why Migrate

The DIY approach works but has limitations:

1. **Protocol Compliance**: Missing standard MCP features:
   - Automatic `Mcp-Session-Id` header management
   - SSE (Server-Sent Events) for server-initiated notifications
   - Stream resumability with `Last-Event-ID`
   - Protocol version negotiation

2. **Maintenance Burden**: Must manually keep up with MCP protocol changes

3. **Type Safety**: Less type safety than SDK-provided abstractions

4. **Testing**: Harder to test against MCP protocol specifications

---

## 2. Official SDK Benefits

**McpServer Class**:
- Manages MCP server lifecycle
- Tool registration with type safety
- Protocol version negotiation
- Automatic error handling and validation

**StreamableHTTPServerTransport**:
- HTTP POST/GET with optional SSE streaming
- Automatic session management
- Request/response handling
- CORS support

**Benefits**:
- ✅ Automatic protocol compliance
- ✅ SSE support for bidirectional communication
- ✅ Session resumability
- ✅ Type-safe tool registration
- ✅ Built-in error handling
- ✅ Future-proof protocol updates

---

## 3. Migration Steps

### Step 1: Upgrade SDK (5 minutes)

```bash
# Update package.json
npm install @modelcontextprotocol/sdk@latest

# Should upgrade from v0.5.0 to v1.10.0+
npm list @modelcontextprotocol/sdk
```

### Step 2: Rewrite src/mcp/server.ts (2-3 hours)

**Delete**: All 1283 lines of current implementation

**Replace with**: SDK-based implementation

#### 2.1 New Imports

```typescript
// src/mcp/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Bindings } from '../types';
import { DB } from '../db';
import { Logger, LogLevel } from '../lib/logger';
```

#### 2.2 Create Server Instance

```typescript
// Create MCP server (singleton)
const mcpServer = new McpServer({
  name: 'zoku',
  version: '1.0.0',
});

// Define context type for dependency injection
interface ZokuContext {
  db: DB;
  encryptionKey: string;
  logger: Logger;
}
```

#### 2.3 Convert Zod Schemas to JSON Schema

Keep existing Zod schemas for validation, but convert to JSON Schema for SDK:

```typescript
// Keep existing Zod schemas
const schemas = {
  list_entanglements: z.object({
    status: z.enum(['draft', 'active', 'paused', 'complete', 'archived']).optional(),
    function: z.enum(['tech_innovation', 'info_tech']).optional(),
    parent_id: z.string().optional(),
    root_only: z.boolean().optional(),
    limit: z.number().optional(),
    detailed: z.boolean().optional()
  }),
  // ... all 28 other schemas
};

// Convert to JSON Schema format
const jsonSchemas = {
  list_entanglements: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['draft', 'active', 'paused', 'complete', 'archived'],
        description: 'Filter by status'
      },
      function: {
        type: 'string',
        enum: ['tech_innovation', 'info_tech'],
        description: 'Filter by function'
      },
      parent_id: { type: 'string', description: 'Get children of specific entanglement' },
      root_only: { type: 'boolean', description: 'Only return top-level', default: false },
      limit: { type: 'number', description: 'Max results', default: 20 },
      detailed: { type: 'boolean', description: 'Return full nested data', default: false }
    }
  },
  // ... convert all 28 other schemas
};
```

**Tip**: Use existing `tools` array definitions (lines 182-613) to copy schema structure directly.

#### 2.4 Register All 29 Tools

Convert switch statement (lines 616-1165) to individual tool registrations:

```typescript
// Entanglement tools
mcpServer.tool(
  'list_entanglements',
  'List entanglements in the Zoku system',
  jsonSchemas.list_entanglements,
  async (input, context: ZokuContext) => {
    const { db, logger } = context;
    const parsed = schemas.list_entanglements.parse(input);

    const entanglements = await db.listEntanglements({
      parent_id: parsed.parent_id,
      root_only: parsed.root_only,
      limit: parsed.limit
    });

    // Always include counts
    const entanglementsWithCounts = await Promise.all(
      entanglements.map(async v => {
        const qupts_count = (await db.listQupts({ entanglement_id: v.id, recursive: true, limit: 1000 })).length;
        const sources_count = (await db.listSources(v.id)).length;

        if (!parsed.detailed) {
          return {
            id: v.id,
            name: v.name,
            parent_id: v.parent_id,
            created_at: v.created_at,
            updated_at: v.updated_at,
            qupts_count,
            sources_count
          };
        }

        return { ...v, qupts_count, sources_count };
      })
    );

    logger.info('Listed entanglements', { count: entanglementsWithCounts.length });
    return { entanglements: entanglementsWithCounts };
  }
);

mcpServer.tool(
  'get_volition',
  'Get entanglement details. By default returns minimal info (counts only). Use detailed=true for full nested data.',
  jsonSchemas.get_volition,
  async (input, context: ZokuContext) => {
    const { db, logger } = context;
    const parsed = schemas.get_volition.parse(input);

    const entanglement = await db.getEntanglement(parsed.id);
    if (!entanglement) throw new Error('Entanglement not found');

    // Default: return minimal info
    if (!parsed.detailed) {
      const childrenCount = (await db.getEntanglementChildren(parsed.id)).length;
      const quptsCount = (await db.listQupts({
        entanglement_id: parsed.id,
        recursive: parsed.include_children_qupts ?? true,
        limit: 1000
      })).length;

      return {
        ...entanglement,
        children_count: childrenCount,
        qupts_count: quptsCount,
        sources_count: (await db.listSources(parsed.id)).length
      };
    }

    // Detailed: return full nested data
    const children = await db.getEntanglementChildren(parsed.id);
    const matrix = await db.getMatrix(parsed.id);
    const attributes = await db.getEntanglementAttributes(parsed.id);
    const qupts = await db.listQupts({
      entanglement_id: parsed.id,
      recursive: parsed.include_children_qupts ?? true,
      limit: 20
    });

    return { ...entanglement, children, matrix, attributes, qupts };
  }
);

// Continue for all 29 tools...
// Copy logic directly from handleToolCall switch statement (lines 616-1165)
// Just wrap each case in mcpServer.tool(name, description, schema, handler)
```

**Pattern for each tool**:
1. Copy tool definition from `tools` array (lines 182-613)
2. Copy implementation from `handleToolCall` switch case (lines 616-1165)
3. Wrap in `mcpServer.tool()` call
4. Extract `db`, `logger`, `encryptionKey` from context parameter
5. Keep all existing validation, error handling, and business logic

#### 2.5 Create New HTTP Handler

Replace `mcpHandler` function (lines 1168-1283) with SDK-based version:

```typescript
// HTTP handler for Hono
export async function mcpHandler(c: Context<{ Bindings: Bindings }>) {
  const db = new DB(c.env.DB);

  // Generate request ID (preserve existing pattern)
  const requestId = crypto.randomUUID().slice(0, 8);
  const logLevel = (c.env?.LOG_LEVEL as LogLevel) || 'info';
  const sessionId = c.req.header('X-Zoku-Session-ID') || undefined;

  const logger = new Logger({
    request_id: requestId,
    session_id: sessionId,
    operation: 'mcp_request',
  }, logLevel);

  logger.info('MCP request received');

  // Create transport (stateless mode for Cloudflare Workers)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,  // Stateless mode
  });

  try {
    // Inject dependencies via context
    mcpServer.setContext<ZokuContext>({
      db,
      encryptionKey: c.env.ENCRYPTION_KEY,
      logger
    });

    // Connect server to transport
    await mcpServer.connect(transport);

    // Transport handles HTTP protocol automatically
    const startTime = Date.now();
    const response = await transport.handleRequest(c.req.raw, c.env as any);
    const duration = Date.now() - startTime;

    logger.info('MCP request completed', { duration_ms: duration });

    return response;
  } catch (error) {
    logger.error('MCP request failed', error as Error);
    throw error;
  } finally {
    await transport.close();
  }
}
```

### Step 3: Test Everything (1-2 hours)

#### 3.1 Start Dev Server

```bash
npm run dev
# Should start on http://localhost:8788
```

#### 3.2 Test Initialize

```bash
curl -X POST http://localhost:8788/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }'

# Expected: 200 OK with server capabilities
```

#### 3.3 Test List Tools

```bash
curl -X POST http://localhost:8788/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'

# Expected: 200 OK with all 29 tools listed
```

#### 3.4 Test Each Tool

Create test script (`scripts/test-mcp-tools.sh`):

```bash
#!/bin/bash

BASE_URL="http://localhost:8788/mcp"

# Test list_entanglements
curl -X POST $BASE_URL -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "list_entanglements",
    "arguments": { "limit": 10 }
  }
}'

# Test get_volition (replace with actual entanglement ID)
curl -X POST $BASE_URL -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "get_volition",
    "arguments": { "id": "vol-1", "detailed": false }
  }
}'

# Test create_entanglement
curl -X POST $BASE_URL -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "create_entanglement",
    "arguments": {
      "name": "Test Entanglement",
      "description": "Testing SDK migration"
    }
  }
}'

# Test list_zoku
curl -X POST $BASE_URL -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "list_zoku",
    "arguments": { "limit": 10 }
  }
}'

# Test list_jewels
curl -X POST $BASE_URL -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "list_jewels",
    "arguments": {}
  }
}'

# ... add tests for all 29 tools
```

Run tests:
```bash
chmod +x scripts/test-mcp-tools.sh
./scripts/test-mcp-tools.sh
```

#### 3.5 Test Error Handling

```bash
# Test with invalid tool name
curl -X POST http://localhost:8788/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 100,
    "method": "tools/call",
    "params": {
      "name": "nonexistent_tool",
      "arguments": {}
    }
  }'

# Expected: JSON-RPC error response

# Test with invalid arguments
curl -X POST http://localhost:8788/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 101,
    "method": "tools/call",
    "params": {
      "name": "list_entanglements",
      "arguments": { "limit": "not_a_number" }
    }
  }'

# Expected: Validation error
```

#### 3.6 Verify Logging

Check console output includes:
- Request IDs
- Session IDs (if provided via header)
- Operation names
- Duration tracking
- Tool execution logs

```bash
# In dev server console, you should see:
# {"timestamp":"...","level":"info","message":"MCP request received","request_id":"abc12345",...}
# {"timestamp":"...","level":"info","message":"Tool execution started","request_id":"abc12345","tool":"list_entanglements",...}
# {"timestamp":"...","level":"info","message":"Listed entanglements","request_id":"abc12345","count":7,...}
# {"timestamp":"...","level":"info","message":"MCP request completed","request_id":"abc12345","duration_ms":45,...}
```

#### 3.7 Frontend Testing (if applicable)

If frontend uses MCP endpoint (currently uses REST API, but verify):
```bash
cd frontend
npm run dev
# Open http://localhost:3000
# Verify all functionality still works
```

---

## 4. Code Changes Summary

### Files to Modify

| File | Change | Complexity |
|------|--------|-----------|
| `package.json` | Update SDK version | Trivial |
| `src/mcp/server.ts` | Complete rewrite (1283 lines) | High |

### Files NOT Changed

- ✅ `src/db.ts` - No changes
- ✅ `src/types.ts` - No changes
- ✅ `src/lib/logger.ts` - No changes
- ✅ `src/lib/crypto.ts` - No changes
- ✅ `src/index.ts` - No changes (route stays `/mcp`)
- ✅ `src/handlers/*` - No changes
- ✅ `frontend/*` - No changes
- ✅ `schema.sql` - No changes

### Functionality Preserved

All 29 tools work identically:
- Same tool names
- Same input schemas
- Same output formats
- Same validation logic
- Same error messages
- Same logging behavior
- Same encryption handling

---

## 5. Implementation Checklist

### Pre-Migration
- [ ] Read this entire document
- [ ] Understand SDK architecture
- [ ] Review official SDK examples

### Migration
- [ ] Upgrade `@modelcontextprotocol/sdk` to v1.10.0+
- [ ] Convert all 29 Zod schemas to JSON Schema format
- [ ] Register all 29 tools with `mcpServer.tool()`
- [ ] Rewrite `mcpHandler` to use `StreamableHTTPServerTransport`
- [ ] Preserve logging integration
- [ ] Preserve error handling

### Testing
- [ ] Test initialize handshake
- [ ] Test tools/list (verify 29 tools)
- [ ] Test all 29 tools with valid input
- [ ] Test error handling (invalid tool, invalid args)
- [ ] Test tools with DB operations
- [ ] Test tools with encryption (jewels)
- [ ] Verify logging output in console
- [ ] Check for any TypeScript errors
- [ ] Verify no performance regression

### Verification
- [ ] All tools return expected results
- [ ] Error messages are clear and helpful
- [ ] Logging includes request IDs and durations
- [ ] No crashes or unhandled errors
- [ ] Frontend still works (if using MCP)

---

## 6. Tool Migration Reference

### Template for Each Tool

```typescript
mcpServer.tool(
  '<tool_name>',           // Copy from tools array
  '<description>',         // Copy from tools array
  jsonSchemas.<tool_name>, // Convert from tools array inputSchema
  async (input, context: ZokuContext) => {
    const { db, logger, encryptionKey } = context;
    const parsed = schemas.<tool_name>.parse(input); // Keep Zod validation

    // Copy implementation from handleToolCall switch case
    // Replace switch (name) { case '<tool_name>': { ... } }
    // with just the implementation logic

    return result; // Return same format as before
  }
);
```

### Example: delete_jewel Tool

**Before** (lines 1143-1154):
```typescript
case 'delete_jewel': {
  const input = schemas.delete_jewel.parse(args);

  // Check if in use
  const usage = await db.getJewelUsage(input.id);
  if (usage.length > 0) {
    throw new Error(`Cannot delete jewel: used by ${usage.length} source(s). Usage: ${usage.map(u => `${u.entanglement_name} (${u.source_type})`).join(', ')}`);
  }

  await db.deleteJewel(input.id);
  return { success: true };
}
```

**After**:
```typescript
mcpServer.tool(
  'delete_jewel',
  'Delete a stored credential (fails if used by any sources)',
  {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Credential ID' }
    },
    required: ['id']
  },
  async (input, context: ZokuContext) => {
    const { db } = context;
    const parsed = schemas.delete_jewel.parse(input);

    // Check if in use (preserve existing validation)
    const usage = await db.getJewelUsage(parsed.id);
    if (usage.length > 0) {
      throw new Error(
        `Cannot delete jewel: used by ${usage.length} source(s). ` +
        `Usage: ${usage.map(u => `${u.entanglement_name} (${u.source_type})`).join(', ')}`
      );
    }

    await db.deleteJewel(parsed.id);
    return { success: true };
  }
);
```

---

## 7. Common Issues & Solutions

### Issue 1: Context Type Errors

**Problem**: TypeScript errors about context parameter

**Solution**: Define ZokuContext interface and use type annotations:
```typescript
interface ZokuContext {
  db: DB;
  encryptionKey: string;
  logger: Logger;
}

mcpServer.tool('tool_name', /* ... */, async (input, context: ZokuContext) => {
  // TypeScript now knows context shape
});
```

### Issue 2: Zod Schema Conversion

**Problem**: SDK needs JSON Schema, have Zod schemas

**Solution**: Keep both! Use Zod for runtime validation, JSON Schema for SDK:
```typescript
// Keep Zod for validation
const parsed = schemas.tool_name.parse(input);

// Use JSON Schema for SDK registration
mcpServer.tool('tool_name', /* ... */, jsonSchemas.tool_name, async (input) => {
  const parsed = schemas.tool_name.parse(input); // Still validates!
});
```

### Issue 3: Import Errors

**Problem**: Can't import from SDK

**Solution**: Check import paths match SDK v1.10.0+:
```typescript
// Correct imports for v1.10.0+
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
```

### Issue 4: Transport Connection Fails

**Problem**: `transport.handleRequest()` returns error

**Solution**: Ensure server is connected before handling request:
```typescript
await mcpServer.connect(transport);  // Must happen first!
const response = await transport.handleRequest(c.req.raw, c.env as any);
```

### Issue 5: Tools Not Registered

**Problem**: `tools/list` returns empty array

**Solution**: Ensure tools are registered at module level (not inside handler):
```typescript
// CORRECT: Register once at module level
const mcpServer = new McpServer({ name: 'zoku', version: '1.0.0' });
mcpServer.tool('tool1', /* ... */);
mcpServer.tool('tool2', /* ... */);

// WRONG: Don't register inside handler
export async function mcpHandler(c) {
  mcpServer.tool('tool1', /* ... */); // ❌ This won't work!
}
```

---

## 8. Success Criteria

### Functional Requirements
- ✅ All 29 MCP tools work identically
- ✅ Same input validation (Zod schemas)
- ✅ Same output formats
- ✅ Same error messages
- ✅ Logging preserved (request IDs, durations)

### Technical Requirements
- ✅ Uses official SDK (v1.10.0+)
- ✅ StreamableHTTPServerTransport for HTTP
- ✅ Stateless mode (no session persistence)
- ✅ Context injection for dependencies
- ✅ No TypeScript errors
- ✅ Dev server starts successfully

### Testing Requirements
- ✅ Initialize handshake works
- ✅ List tools returns 29 tools
- ✅ Each tool executes successfully
- ✅ Error handling works (invalid input)
- ✅ Logging appears in console
- ✅ Performance acceptable (< 100ms per tool call)

---

## 9. Current Tool List (29 Tools)

### Entanglements (7)
1. `list_entanglements` - List projects (lines 618-651)
2. `get_volition` - Get project details (lines 653-686)
3. `get_child_entanglements` - Get children (lines 688-694)
4. `create_entanglement` - Create project (lines 696-716)
5. `update_entanglement` - Update project (lines 718-726)
6. `move_entanglement` - Move project (lines 728-732)
7. `delete_entanglement` - Delete project (lines 734-741)

### Activity/Qupts (2)
8. `create_qupt` - Record activity (lines 743-753)
9. `list_qupts` - List activity (lines 755-781)

### Zoku (3)
10. `list_zoku` - List partners (lines 783-790)
11. `create_zoku` - Create partner (lines 792-796)
12. `get_entangled` - Get partner details (lines 798-803)

### PASCI Matrix (3)
13. `entangle` - Assign role (lines 805-810)
14. `disentangle` - Remove role (lines 812-816)
15. `get_matrix` - View matrix (lines 818-822)

### Taxonomy (3)
16. `list_dimensions` - List dimensions (lines 824-831)
17. `set_attributes` - Set attributes (lines 833-848)
18. `get_attributes` - Get attributes (lines 850-854)

### Sources (5)
19. `list_sources` - List sources (lines 856-866)
20. `add_source` - Add source (lines 868-940)
21. `sync_source` - Sync source (lines 942-998)
22. `remove_source` - Remove source (lines 1000-1004)
23. `toggle_source` - Enable/disable (lines 1006-1010)

### Jewels/Credentials (6)
24. `add_jewel` - Store credential (lines 1013-1061)
25. `list_jewels` - List credentials (lines 1063-1082)
26. `get_credential` - Get credential (lines 1084-1098)
27. `update_jewel` - Update credential (lines 1100-1141)
28. `delete_jewel` - Delete credential (lines 1143-1154)
29. `get_jewel_usage` - Check usage (lines 1156-1160)

---

## 10. References

### Official Documentation
- [MCP Specification](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Transports](https://modelcontextprotocol.io/docs/concepts/transports)
- [Streamable HTTP Transport](https://blog.fka.dev/blog/2025-06-06-why-mcp-deprecated-sse-and-go-with-streamable-http/)

### Example Implementations
- [MCP Hono Stateless Example](https://github.com/mhart/mcp-hono-stateless)
- [@hono/mcp Package](https://jsr.io/@hono/mcp)
- [Official SDK Examples](https://github.com/modelcontextprotocol/typescript-sdk/tree/main/src/examples/server)

---

## Appendix: Complete Example

Here's a complete minimal example showing the pattern:

```typescript
// src/mcp/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Bindings } from '../types';
import { DB } from '../db';
import { Logger, LogLevel } from '../lib/logger';

// Context type
interface ZokuContext {
  db: DB;
  encryptionKey: string;
  logger: Logger;
}

// Create server
const mcpServer = new McpServer({
  name: 'zoku',
  version: '1.0.0',
});

// Zod schemas (keep existing)
const schemas = {
  list_entanglements: z.object({
    limit: z.number().optional(),
    // ... rest of schema
  }),
  // ... all 28 other schemas
};

// JSON schemas for SDK
const jsonSchemas = {
  list_entanglements: {
    type: 'object',
    properties: {
      limit: { type: 'number', default: 20 },
      // ... rest of schema
    }
  },
  // ... all 28 other schemas
};

// Register all tools
mcpServer.tool(
  'list_entanglements',
  'List entanglements',
  jsonSchemas.list_entanglements,
  async (input, context: ZokuContext) => {
    const { db, logger } = context;
    const parsed = schemas.list_entanglements.parse(input);

    const entanglements = await db.listEntanglements({ limit: parsed.limit });

    logger.info('Listed entanglements', { count: entanglements.length });
    return { entanglements };
  }
);

// ... register all 28 other tools

// HTTP handler
export async function mcpHandler(c: Context<{ Bindings: Bindings }>) {
  const db = new DB(c.env.DB);
  const requestId = crypto.randomUUID().slice(0, 8);
  const logLevel = (c.env?.LOG_LEVEL as LogLevel) || 'info';
  const logger = new Logger({ request_id: requestId, operation: 'mcp_request' }, logLevel);

  logger.info('MCP request received');

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  try {
    mcpServer.setContext<ZokuContext>({
      db,
      encryptionKey: c.env.ENCRYPTION_KEY,
      logger
    });

    await mcpServer.connect(transport);

    const startTime = Date.now();
    const response = await transport.handleRequest(c.req.raw, c.env as any);
    const duration = Date.now() - startTime;

    logger.info('MCP request completed', { duration_ms: duration });
    return response;
  } catch (error) {
    logger.error('MCP request failed', error as Error);
    throw error;
  } finally {
    await transport.close();
  }
}
```

---

## Next Steps

1. ✅ Upgrade SDK: `npm install @modelcontextprotocol/sdk@latest`
2. ✅ Rewrite `src/mcp/server.ts` using patterns above
3. ✅ Test all 29 tools locally with `npm run dev`
4. ✅ Verify logging works
5. ✅ Commit and done!

**Estimated Time**: 3-5 hours total
