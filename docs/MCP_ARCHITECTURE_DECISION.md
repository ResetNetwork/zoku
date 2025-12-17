# MCP Architecture Decision: Should MCP Call REST API?
**Date**: December 16, 2025  
**Question**: Should MCP tools call REST API endpoints (like the UI) or access database directly?  
**Decision**: ✅ **YES - MCP should call internal REST API**

---

## TL;DR Recommendation

**Make MCP call internal REST API endpoints** instead of accessing the database directly.

**Why:**
1. Single source of truth for validation and business logic
2. MCP becomes a "client" just like the web UI
3. Simpler architecture (no duplication)
4. Better security (validation enforced in one place)
5. Easier to maintain (one codebase to update)

**How:**
- MCP tools make internal HTTP requests to REST API
- Use service account token for authentication
- Transform REST responses to MCP format

---

## Analysis of Options

### Current Architecture (Option 3)

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
    │  REST API    │        │  MCP Handler │
    │              │        │              │
    │  Validation  │        │  Validation  │ ← DUPLICATION
    │  Auth        │        │  Auth        │ ← DUPLICATION
    │  Business    │        │  Business    │ ← DUPLICATION
    └──────┬───────┘        └──────┬───────┘
           │                        │
           └────────┬───────────────┘
                    ▼
            ┌──────────────┐
            │   Database   │
            └──────────────┘
```

**Problems:**
- ❌ Validation rules duplicated (REST has Zod, MCP has Zod)
- ❌ Business logic duplicated (both call DB directly)
- ❌ Authorization duplicated (REST has tier checks, MCP has tier checks)
- ❌ Can get out of sync (REST API updated, MCP forgotten)
- ❌ Tests need to cover both paths

**Current stats:**
- REST API: ~800 lines of validation + business logic
- MCP Handler: ~1600 lines of validation + business logic
- Total: ~2400 lines with duplication

### Proposed Architecture (Option 1) - RECOMMENDED

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
    │  REST API    │◄───────│  MCP Handler │
    │              │        │  (thin)      │
    │  Validation  │        │              │
    │  Auth        │        │  Just:       │
    │  Business    │        │  - REST call │
    │  Audit       │        │  - Format    │
    └──────┬───────┘        └──────────────┘
           │
           ▼
    ┌──────────────┐
    │   Database   │
    └──────────────┘
```

**Benefits:**
- ✅ Single validation path (REST API)
- ✅ Single business logic (REST API)
- ✅ Single authorization path (REST API)
- ✅ Consistent behavior (both use same code)
- ✅ Easier to test (test REST API once)
- ✅ MCP handler becomes thin wrapper (~200 lines)

**New stats:**
- REST API: ~800 lines (unchanged)
- MCP Handler: ~200 lines (just protocol translation)
- Total: ~1000 lines (58% reduction!)

---

## Implementation Plan

### Step 1: Create Internal API Client (~1 hour)

**`src/lib/internal-api-client.ts`**:
```typescript
import type { Bindings } from '../types';

/**
 * Internal API client for MCP to call REST API
 * Makes internal requests without going over the network
 */
export class InternalApiClient {
  constructor(
    private env: Bindings,
    private app: any, // Hono app instance
    private token: string // Service account token
  ) {}

  async request(method: string, path: string, body?: any) {
    // Create internal request
    const req = new Request(`http://internal${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    // Call app directly (no network round-trip)
    const response = await this.app.fetch(req, this.env);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.error || 'API request failed');
    }

    return response.json();
  }

  // Convenience methods
  async get(path: string) {
    return this.request('GET', path);
  }

  async post(path: string, body: any) {
    return this.request('POST', path, body);
  }

  async patch(path: string, body: any) {
    return this.request('PATCH', path, body);
  }

  async delete(path: string) {
    return this.request('DELETE', path);
  }
}
```

### Step 2: Update MCP Handler to Use API (~2 hours)

**Before** (direct DB access):
```typescript
server.tool('create_entanglement', 'Create entanglement', schema, async (args) => {
  const db = new DB(env.DB);
  
  // Validate
  if (!args.name) {
    throw new Error('Name required');
  }
  
  // Check parent
  if (args.parent_id) {
    const parent = await db.getEntanglement(args.parent_id);
    if (!parent) {
      throw new Error('Parent not found');
    }
  }
  
  // Create
  const entanglement = await db.createEntanglement({
    name: args.name,
    description: args.description,
    parent_id: args.parent_id
  });
  
  // Assign PASCI
  if (args.initial_zoku) {
    for (const z of args.initial_zoku) {
      await db.assignToMatrix(entanglement.id, z.zoku_id, z.role);
    }
  }
  
  return { entanglement };
});
```

**After** (calls REST API):
```typescript
server.tool('create_entanglement', 'Create entanglement', schema, async (args) => {
  const api = new InternalApiClient(env, app, serviceToken);
  
  // Call REST API (validation, auth, business logic all handled there)
  const entanglement = await api.post('/api/entanglements', args);
  
  return { entanglement };
});
```

**Reduction: 30 lines → 5 lines per tool (83% smaller!)**

### Step 3: Remove Duplicate Validation from MCP (~1 hour)

Since REST API validates, MCP schemas become simpler:

**Before**:
```typescript
const createEntanglementSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(10000).optional(),
  parent_id: z.string().uuid().optional(),
  initial_zoku: z.array(...).optional()
});
```

**After**:
```typescript
// Just basic types for MCP tool description
const createEntanglementSchema = z.object({
  name: z.string().describe('Name'),
  description: z.string().optional().describe('Description'),
  parent_id: z.string().optional().describe('Parent ID'),
  initial_zoku: z.array(...).optional().describe('Initial PASCI')
});
// Actual validation happens in REST API
```

### Step 4: Create Service Account for MCP (~30 min)

**In `src/mcp/server.ts`**:
```typescript
// Generate long-lived service account token for MCP internal use
const SERVICE_ACCOUNT_TOKEN = await generateServiceToken(env, 'mcp-internal');

export async function mcpHandler(c: Context) {
  // ... existing auth code ...
  
  // Create API client for this request
  const api = new InternalApiClient(c.env, app, SERVICE_ACCOUNT_TOKEN);
  
  // Pass to tools via context
  const transport = new StreamableHTTPTransport('/mcp', server, {
    api, // Tools can access via context
    db,
    env,
    logger,
    user
  });
  
  // ... rest of handler
}
```

### Step 5: Update All 29 MCP Tools (~3 hours)

Pattern for each tool:

```typescript
// OLD (direct DB)
server.tool('tool_name', 'Description', schema, async (args) => {
  const db = new DB(env.DB);
  const result = await db.operation(args);
  return { result };
});

// NEW (via REST API)
server.tool('tool_name', 'Description', schema, async (args, { api }) => {
  const result = await api.post('/api/endpoint', args);
  return { result };
});
```

**Estimated time per tool: 5-10 minutes × 29 tools = 2-3 hours**

### Step 6: Test MCP Integration (~2 hours)

- Test all 29 MCP tools
- Verify validation works (try invalid inputs)
- Verify tier enforcement works
- Verify audit logging works
- Verify error messages are clear

**Total implementation time: 8-10 hours**

---

## Addressing Concerns

### Concern 1: Performance Overhead

**Q**: Won't internal HTTP calls be slower than direct DB access?

**A**: No significant impact because:
- Requests are internal (no network)
- Hono is extremely fast (< 1ms overhead)
- Validation overhead already exists (both paths validate)
- Database is the bottleneck, not middleware

**Benchmarks** (estimated):
- Direct DB: ~5ms total (4ms DB, 1ms validation)
- Via REST API: ~6ms total (4ms DB, 1ms validation, 1ms middleware)
- **Difference: ~1ms (20% overhead, negligible)**

### Concern 2: Circular Dependencies

**Q**: Won't MCP calling REST API create circular imports?

**A**: No, because:
- MCP handler lives in `src/mcp/server.ts`
- REST API lives in `src/api/*.ts`
- InternalApiClient is in `src/lib/internal-api-client.ts`
- MCP imports lib (not API), calls app at runtime
- No circular dependency

**Dependency graph**:
```
src/index.ts
  ├─> src/api/*.ts (REST routes)
  └─> src/mcp/server.ts (MCP handler)
        └─> src/lib/internal-api-client.ts
              └─> calls app at runtime (passed in)
```

### Concern 3: Error Handling

**Q**: How do we translate REST errors to MCP errors?

**A**: Simple mapping in MCP handler:

```typescript
try {
  const result = await api.post('/api/entanglements', args);
  return { entanglement: result };
} catch (error) {
  // REST API returns structured errors
  // { error: { code: 'VALIDATION_ERROR', message: '...' } }
  
  // Map to MCP JSON-RPC error codes
  if (error.message.includes('VALIDATION_ERROR')) {
    throw new Error(error.message); // MCP client sees validation error
  }
  if (error.message.includes('NOT_FOUND')) {
    throw new Error(error.message); // MCP client sees not found
  }
  throw error; // Generic error
}
```

MCP SDK handles error formatting automatically.

---

## Comparison Matrix

| Aspect | Direct DB (Current) | Service Layer | REST API (Proposed) |
|--------|-------------------|---------------|---------------------|
| **Code duplication** | ❌ High | ✅ Low | ✅ None |
| **Validation consistency** | ❌ Can drift | ✅ Shared | ✅ Single source |
| **Implementation effort** | ✅ Already done | ⚠️ 10-12 hours | ✅ 8-10 hours |
| **Performance** | ✅ Fastest (~5ms) | ✅ Fast (~5ms) | ✅ Fast (~6ms) |
| **Maintainability** | ❌ Hard (2 places) | ✅ Good (services) | ✅ Best (1 place) |
| **Testing complexity** | ❌ High (2 paths) | ✅ Medium | ✅ Low (1 path) |
| **Architecture clarity** | ❌ Unclear | ✅ Good | ✅ Excellent |
| **Security** | ⚠️ Validate 2x | ✅ Validate 1x | ✅ Validate 1x |
| **Audit logging** | ⚠️ Manual 2x | ✅ Automatic | ✅ Automatic |

**Winner: REST API approach** ✅

---

## Migration Path

### Option A: Do it now (before production)
- **Time**: 8-10 hours
- **Risk**: Low (well-defined changes)
- **Benefit**: Ship with clean architecture
- **Downside**: Delays production by 1-2 days

### Option B: Ship now, refactor later
- **Time**: Ship today, refactor in Sprint 2
- **Risk**: None (current code works)
- **Benefit**: Get to production faster
- **Downside**: Live with technical debt for 2 weeks

### Option C: Hybrid approach (RECOMMENDED)
1. **Today**: Document the decision (this file)
2. **This week**: Implement critical tools (5-6 most used)
3. **Next week**: Migrate remaining tools
4. **Ship**: With partial migration (better than nothing)

**Recommended: Option C** - Start migration, ship when 80% done

---

## Real-World Examples

### Example: Stripe API Architecture

Stripe has multiple SDKs (Python, Ruby, JavaScript, etc.) that all:
- ✅ Call the same REST API
- ✅ Share validation rules
- ✅ Get automatic updates when API changes

**They don't**:
- ❌ Have duplicate business logic in each SDK
- ❌ Access database directly from SDKs

**Result**: Consistent behavior, easy maintenance

### Example: AWS SDK Architecture

AWS SDKs for all languages:
- ✅ Call the same service APIs
- ✅ Share API contracts (OpenAPI specs)
- ✅ Automatically benefit from service improvements

**They don't**:
- ❌ Duplicate service logic in SDKs
- ❌ Access DynamoDB/S3 storage directly

**Result**: Single source of truth, easier to maintain

---

## Decision

✅ **YES - MCP should call internal REST API endpoints**

**Rationale:**
1. Industry best practice (Stripe, AWS, Twilio all do this)
2. Eliminates code duplication (~58% code reduction)
3. Single source of truth for validation
4. Easier to maintain (update REST API, MCP benefits automatically)
5. Consistent behavior across all clients
6. Minimal performance impact (~1ms overhead)
7. Simpler architecture (MCP becomes thin protocol wrapper)

**Implementation:**
- Create InternalApiClient for MCP to call REST API
- Update 29 MCP tools to use API instead of direct DB
- Remove duplicate validation from MCP
- Keep MCP schemas simple (just for tool descriptions)

**Timeline:**
- Critical tools (5-6): This week
- Remaining tools (23-24): Next week  
- Total effort: 8-10 hours spread over 2 weeks

**Benefits:**
- 📉 ~1200 lines of duplicate code removed
- ✅ Single validation path
- ✅ Single authorization path
- ✅ Single audit logging path
- ✅ Easier to maintain
- ✅ Consistent behavior

---

## Next Steps

1. **Document this decision** ✅ (this file)
2. **Get team agreement** on approach
3. **Implement InternalApiClient** (~1 hour)
4. **Migrate 5 critical tools** (~2 hours):
   - create_entanglement
   - create_qupt
   - create_zoku
   - entangle (PASCI assignment)
   - add_jewel
5. **Test migrated tools** (~1 hour)
6. **Ship with partial migration**
7. **Complete migration** in Sprint 2

---

*Decision documented: December 16, 2025*  
*Recommended approach: MCP calls REST API (Option 1)*  
*Estimated effort: 8-10 hours*  
*Timeline: Start this week, complete Sprint 2*
