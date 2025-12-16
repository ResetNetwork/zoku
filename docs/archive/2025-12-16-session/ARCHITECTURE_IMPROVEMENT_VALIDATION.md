# Architecture Improvement: Unified Validation Layer
**Date**: December 16, 2025  
**Status**: 🎯 Recommended Improvement  
**Priority**: P1 (Should do before production)

## Problem Identified

Currently, validation happens in **two separate places**:

1. **REST API** (`src/api/*.ts`):
   - Uses Zod schemas from `src/lib/validation.ts`
   - Validates HTTP request bodies
   - Returns JSON error responses

2. **MCP Tools** (`src/mcp/server.ts`):
   - Has its own Zod schemas defined inline
   - Validates MCP tool arguments
   - Returns MCP-formatted errors

**Issues with this approach:**
- ❌ **Duplication**: Same validation rules defined twice
- ❌ **Inconsistency**: Rules can drift apart (one updated, other forgotten)
- ❌ **Maintenance burden**: Every change needs to be made in 2 places
- ❌ **Testing complexity**: Need to test validation in both layers
- ❌ **Business logic mixed with transport**: DB calls directly in both REST and MCP handlers

## Current Architecture (Problematic)

```
┌─────────────────────────────────────────────────────┐
│                    Client Layer                      │
├──────────────────────┬──────────────────────────────┤
│   REST API Client    │      MCP Client              │
└──────────┬───────────┴────────────┬─────────────────┘
           │                        │
           ▼                        ▼
    ┌──────────────┐        ┌──────────────┐
    │  REST Routes │        │  MCP Tools   │
    │              │        │              │
    │  Validation  │        │  Validation  │  ← DUPLICATION!
    │  (Zod)       │        │  (Zod)       │
    │              │        │              │
    │  DB Calls    │        │  DB Calls    │  ← DUPLICATION!
    └──────┬───────┘        └──────┬───────┘
           │                        │
           └────────┬───────────────┘
                    ▼
            ┌──────────────┐
            │   Database   │
            └──────────────┘
```

**Problems:**
- Validation duplicated in both layers
- Business logic duplicated in both layers
- Two places to update for every change

## Recommended Architecture (Clean)

```
┌─────────────────────────────────────────────────────┐
│                    Client Layer                      │
├──────────────────────┬──────────────────────────────┤
│   REST API Client    │      MCP Client              │
└──────────┬───────────┴────────────┬─────────────────┘
           │                        │
           ▼                        ▼
    ┌──────────────┐        ┌──────────────┐
    │  REST Routes │        │  MCP Tools   │
    │  (thin)      │        │  (thin)      │  ← Just format conversion
    └──────┬───────┘        └──────┬───────┘
           │                        │
           └────────┬───────────────┘
                    ▼
         ┌────────────────────┐
         │  Business Logic    │
         │   Layer            │
         │                    │  ← SINGLE PLACE for:
         │  - Validation      │     • Validation
         │  - Authorization   │     • Authorization
         │  - Business rules  │     • Business logic
         │  - DB operations   │     • DB operations
         └─────────┬──────────┘
                   ▼
           ┌──────────────┐
           │   Database   │
           └──────────────┘
```

**Benefits:**
- ✅ Validation in one place
- ✅ Business logic in one place  
- ✅ Consistent behavior across transports
- ✅ Easier to test
- ✅ Easier to maintain

## Implementation Plan

### Step 1: Create Business Logic Layer (~4 hours)

Create `src/services/` directory with service classes:

**`src/services/entanglements.ts`**:
```typescript
import { z } from 'zod';
import { DB } from '../db';
import { createEntanglementSchema } from '../lib/validation';
import { NotFoundError, ValidationError } from '../lib/errors';

export class EntanglementService {
  constructor(private db: DB) {}

  async create(input: unknown) {
    // Validate input
    const data = createEntanglementSchema.parse(input);
    
    // Check parent exists
    if (data.parent_id) {
      const parent = await this.db.getEntanglement(data.parent_id);
      if (!parent) {
        throw new NotFoundError('Parent entanglement', data.parent_id);
      }
    }
    
    // Create entanglement
    const entanglement = await this.db.createEntanglement({
      name: data.name,
      description: data.description,
      parent_id: data.parent_id
    });
    
    // Assign initial zoku
    if (data.initial_zoku) {
      for (const assignment of data.initial_zoku) {
        await this.db.assignToMatrix(
          entanglement.id,
          assignment.zoku_id,
          assignment.role
        );
      }
    }
    
    return entanglement;
  }
  
  async update(id: string, input: unknown) {
    const data = updateEntanglementSchema.parse(input);
    
    const entanglement = await this.db.getEntanglement(id);
    if (!entanglement) {
      throw new NotFoundError('Entanglement', id);
    }
    
    // Validate parent
    if (data.parent_id !== undefined && data.parent_id !== null) {
      const parent = await this.db.getEntanglement(data.parent_id);
      if (!parent) {
        throw new NotFoundError('Parent entanglement', data.parent_id);
      }
      
      // Check circular reference
      const descendants = await this.db.getEntanglementDescendants(id);
      if (descendants.some(d => d.id === data.parent_id)) {
        throw new ValidationError('Cannot set parent: would create circular reference');
      }
    }
    
    await this.db.updateEntanglement(id, data);
    return this.db.getEntanglement(id);
  }
  
  // ... other methods
}
```

### Step 2: Update REST API Routes (~2 hours)

Thin wrapper that calls service:

**`src/api/entanglements.ts`**:
```typescript
import { Hono } from 'hono';
import { EntanglementService } from '../services/entanglements';
import { requireTier } from '../middleware/auth';

const app = new Hono<{ Bindings: Bindings }>();

app.post('/', requireTier('entangled'), async (c) => {
  const db = new DB(c.env.DB);
  const service = new EntanglementService(db);
  const body = await c.req.json();
  
  const entanglement = await service.create(body);
  return c.json(entanglement, 201);
});

app.patch('/:id', requireTier('entangled'), async (c) => {
  const db = new DB(c.env.DB);
  const service = new EntanglementService(db);
  const body = await c.req.json();
  
  const entanglement = await service.update(c.req.param('id'), body);
  return c.json(entanglement);
});
```

### Step 3: Update MCP Tools (~2 hours)

Thin wrapper that calls the same service:

**`src/mcp/server.ts`**:
```typescript
server.tool('create_entanglement', 'Create a new entanglement', {
  name: z.string(),
  description: z.string().optional(),
  parent_id: z.string().optional(),
  initial_zoku: z.array(z.object({
    zoku_id: z.string(),
    role: z.enum(['perform', 'accountable', 'control', 'support', 'informed'])
  })).optional()
}, async (args) => {
  const db = new DB(env.DB);
  const service = new EntanglementService(db);
  
  const entanglement = await service.create(args);
  return { entanglement };
});
```

### Step 4: Shared Validation (~30 min)

Both REST and MCP can reference the same schemas:

**`src/lib/validation.ts`** (already created):
```typescript
export const createEntanglementSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(10000).optional(),
  parent_id: z.string().uuid().optional(),
  initial_zoku: z.array(z.object({
    zoku_id: z.string(),
    role: z.enum(['perform', 'accountable', 'control', 'support', 'informed'])
  })).optional()
});
```

Both layers import and use this schema!

### Step 5: Testing (~2 hours)

- Test REST API calls service correctly
- Test MCP tools call service correctly
- Verify validation works the same in both
- Test error handling in both transports

**Total effort: ~10-12 hours**

## Migration Strategy

### Phase 1: Create Services (Week 1)
- Create `src/services/` directory
- Implement EntanglementService
- Implement ZokuService
- Implement QuptService
- Keep existing API routes working

### Phase 2: Migrate REST API (Week 2)
- Update REST routes to call services
- Remove duplicate validation from routes
- Keep MCP working with old approach
- Test REST API thoroughly

### Phase 3: Migrate MCP (Week 2)
- Update MCP tools to call services
- Remove duplicate validation from MCP
- Test MCP thoroughly
- Both now use same logic!

### Phase 4: Cleanup (Week 2)
- Remove any remaining duplicate code
- Document new architecture
- Update tests
- Deploy to production

## Benefits Summary

### Before (Current State)
- 2 validation layers (REST + MCP)
- 2 business logic implementations
- ~1600 lines in mcp/server.ts (business logic mixed with MCP protocol)
- ~800 lines across API routes (business logic mixed with HTTP)
- Total: ~2400 lines of mixed concerns

### After (Proposed)
- 1 validation layer (services)
- 1 business logic implementation
- ~800 lines in services/ (pure business logic)
- ~400 lines in API routes (thin HTTP wrappers)
- ~400 lines in mcp/server.ts (thin MCP wrappers)
- Total: ~1600 lines of separated concerns

**Reduction: ~800 lines of duplicate code removed (33% smaller)**

### Code Quality Improvements
- ✅ Single source of truth for validation
- ✅ Easier to test (test service once, not REST + MCP)
- ✅ Consistent behavior across transports
- ✅ Separation of concerns (transport vs business logic)
- ✅ Easier to add new transports (GraphQL, gRPC, etc.)
- ✅ Business logic reusable outside of HTTP/MCP

## Current Status

**What we fixed today:**
- ✅ REST API has validation (via Zod schemas)
- ✅ Error sanitization works
- ⚠️ MCP tools bypass REST validation (use separate schemas)
- ⚠️ Business logic duplicated in 2 places

**What still needs work:**
- 🔄 Unify validation layer (create services)
- 🔄 Remove duplicate business logic
- 🔄 Make MCP use same validation as REST

## Recommendation

**Option A: Ship now, refactor later** (Recommended)
- ✅ Current security is adequate (both layers validate)
- ✅ Can ship to production safely
- 📅 Schedule refactor for Sprint 2 (2 weeks after launch)
- ⏱️ Allows time to gather user feedback first

**Option B: Refactor before shipping**
- 📅 Delays production by 1-2 weeks
- ✅ Better architecture from day 1
- ⚠️ Risk: might not need all this if usage patterns change

**My recommendation: Option A**
- Ship with current architecture (it works!)
- Both REST and MCP validate (just separately)
- Gather usage data to inform refactor
- Do proper refactor in Sprint 2 with lessons learned

## Conclusion

You identified a real architectural issue! The current approach works but has duplication. The fix is straightforward:

1. Create service layer with shared validation
2. Make REST API call services
3. Make MCP tools call services
4. Remove duplicate code

This is **good practice** but not **security critical**. Both layers validate, just separately. The refactor would improve maintainability and consistency, but isn't blocking production.

**Priority: P1 (Important but not urgent)**

---

*Analysis completed: December 16, 2025*  
*Estimated refactor effort: 10-12 hours*  
*Recommended timeline: Sprint 2 (post-launch)*
