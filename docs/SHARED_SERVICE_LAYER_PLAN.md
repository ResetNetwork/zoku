# Shared Service Layer Implementation Plan
**Date**: December 16, 2025  
**Goal**: Create shared business logic layer that both REST API and MCP use  
**Benefit**: Single validation path, zero code duplication  
**Estimated Effort**: 12-16 hours

---

## Architecture Overview

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
    │  REST Routes │        │  MCP Tools   │
    │  (thin)      │        │  (thin)      │
    │              │        │              │
    │  - Parse req │        │  - Parse MCP │
    │  - Format    │        │  - Format    │
    │  - HTTP resp │        │  - MCP resp  │
    └──────┬───────┘        └──────┬───────┘
           │                        │
           └────────┬───────────────┘
                    ▼
         ┌─────────────────────┐
         │   SERVICE LAYER     │ ← SINGLE SOURCE OF TRUTH
         │                     │
         │  - Validation       │ (using Zod schemas)
         │  - Authorization    │ (tier checks)
         │  - Business logic   │ (all rules here)
         │  - Audit logging    │ (automatic)
         │  - DB operations    │ (transactions)
         └──────────┬──────────┘
                    ▼
            ┌──────────────┐
            │   Database   │
            └──────────────┘
```

**Key Principles:**
1. **Services own the business logic** - REST and MCP are just transport layers
2. **Single validation path** - Only services validate, using Zod schemas from `src/lib/validation.ts`
3. **Services throw errors** - REST/MCP catch and format them appropriately
4. **Services return plain objects** - No HTTP responses, no MCP responses
5. **Services are testable** - Can test without REST or MCP

---

## Directory Structure

```
src/
├── services/              # NEW - Business logic layer
│   ├── entanglements.ts   # Entanglement operations
│   ├── zoku.ts            # Zoku operations
│   ├── qupts.ts           # Qupt operations
│   ├── sources.ts         # Source operations
│   ├── jewels.ts          # Jewel operations
│   ├── matrix.ts          # PASCI matrix operations
│   ├── attributes.ts      # Taxonomy operations
│   └── index.ts           # Export all services
│
├── api/                   # UPDATED - Thin REST wrappers
│   ├── entanglements.ts   # Calls EntanglementService
│   ├── zoku.ts            # Calls ZokuService
│   ├── qupts.ts           # Calls QuptService
│   └── ...
│
├── mcp/                   # UPDATED - Thin MCP wrappers
│   └── server.ts          # Calls services (not DB)
│
├── lib/
│   ├── validation.ts      # Zod schemas (already exists)
│   └── errors.ts          # Error classes (already exists)
│
└── db.ts                  # Database operations (unchanged)
```

---

## Implementation Plan

### Phase 1: Create Base Service Class (1 hour)

**`src/services/base.ts`**:
```typescript
import { DB } from '../db';
import type { Zoku } from '../types';
import { Logger } from '../lib/logger';

/**
 * Base class for all services
 * Provides common functionality: validation, authorization, logging
 */
export abstract class BaseService {
  protected db: DB;
  protected user: Zoku;
  protected logger: Logger;
  protected requestId?: string;

  constructor(db: DB, user: Zoku, logger: Logger, requestId?: string) {
    this.db = db;
    this.user = user;
    this.logger = logger;
    this.requestId = requestId;
  }

  /**
   * Validate input against Zod schema
   * Throws ZodError on validation failure
   */
  protected validate<T>(schema: { parse: (data: any) => T }, data: unknown): T {
    return schema.parse(data);
  }

  /**
   * Check user has minimum tier
   * Throws ForbiddenError if insufficient
   */
  protected requireTier(minTier: 'coherent' | 'entangled' | 'prime') {
    const tierLevels = {
      observed: 0,
      coherent: 1,
      entangled: 2,
      prime: 3
    };

    const userLevel = tierLevels[this.user.access_tier];
    const requiredLevel = tierLevels[minTier];

    if (userLevel < requiredLevel) {
      const { ForbiddenError } = require('../lib/errors');
      throw new ForbiddenError(
        `This action requires ${minTier} access or higher. You have ${this.user.access_tier} access.`
      );
    }
  }

  /**
   * Create audit log entry
   */
  protected async audit(action: string, resourceType: string, resourceId: string, details?: any) {
    await this.db.createAuditLog({
      zoku_id: this.user.id,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details: details ? JSON.stringify(details) : null,
      request_id: this.requestId
    });
  }
}
```

### Phase 2: Create EntanglementService (2 hours)

**`src/services/entanglements.ts`**:
```typescript
import { BaseService } from './base';
import {
  createEntanglementSchema,
  updateEntanglementSchema,
  assignToMatrixSchema,
  setAttributesSchema,
  addAttributeSchema
} from '../lib/validation';
import { NotFoundError, ValidationError } from '../lib/errors';
import type { Entanglement } from '../types';

export class EntanglementService extends BaseService {
  /**
   * List entanglements with optional filters
   */
  async list(filters: {
    root_only?: boolean;
    parent_id?: string;
    status?: string;
    function?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    // No tier check - all authenticated users can list
    
    const entanglements = await this.db.listEntanglements({
      root_only: filters.root_only || false,
      parent_id: filters.parent_id,
      limit: filters.limit || 20,
      offset: filters.offset || 0
    });

    // Enrich with counts and attributes
    const attributesMap = await this.db.getEntanglementsAttributes(
      entanglements.map(v => v.id)
    );

    const enriched = await Promise.all(
      entanglements.map(async (v) => ({
        ...v,
        children_count: await this.db.getEntanglementChildrenCount(v.id),
        qupts_count: await this.db.getEntanglementQuptsCount(v.id, true),
        sources_count: await this.db.getEntanglementSourcesCount(v.id),
        zoku_count: await this.db.getEntanglementZokuCount(v.id),
        attributes: attributesMap.get(v.id) || null
      }))
    );

    return enriched;
  }

  /**
   * Get single entanglement by ID
   */
  async get(id: string, includeChildrenQupts = true) {
    const entanglement = await this.db.getEntanglement(id);
    if (!entanglement) {
      throw new NotFoundError('Entanglement', id);
    }

    // Get related data
    const [children, matrix, attributes, qupts, counts] = await Promise.all([
      this.db.getEntanglementChildren(id),
      this.db.getMatrix(id),
      this.db.getEntanglementAttributes(id),
      this.db.listQupts({
        entanglement_id: id,
        recursive: includeChildrenQupts,
        limit: 20
      }),
      Promise.all([
        this.db.getEntanglementChildrenCount(id),
        this.db.getEntanglementQuptsCount(id, true),
        this.db.getEntanglementSourcesCount(id),
        this.db.getEntanglementZokuCount(id)
      ])
    ]);

    const [children_count, qupts_count, sources_count, zoku_count] = counts;

    // Build attributes map
    const dimensions = await this.db.listDimensions();
    const dimensionValues = await this.db.getAllDimensionValues();
    const attributesMap: Record<string, any> = {};

    for (const attr of attributes) {
      const dimension = dimensions.find(d => d.id === attr.dimension_id);
      const value = dimensionValues.find(v => v.id === attr.value_id);
      if (dimension && value) {
        if (!attributesMap[dimension.name]) {
          attributesMap[dimension.name] = {
            dimension_id: dimension.id,
            label: dimension.label,
            values: []
          };
        }
        attributesMap[dimension.name].values.push({
          id: value.id,
          value: value.value,
          label: value.label
        });
      }
    }

    return {
      ...entanglement,
      attributes: attributesMap,
      matrix,
      children: children.map(c => ({
        id: c.id,
        name: c.name,
        created_at: c.created_at
      })),
      qupts,
      children_count,
      qupts_count,
      sources_count,
      zoku_count
    };
  }

  /**
   * Create new entanglement
   */
  async create(input: unknown): Promise<Entanglement> {
    this.requireTier('entangled');

    // Validate input
    const data = this.validate(createEntanglementSchema, input);

    // Verify parent exists if provided
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

    // Assign initial zoku if provided
    if (data.initial_zoku) {
      for (const assignment of data.initial_zoku) {
        try {
          await this.db.assignToMatrix(
            entanglement.id,
            assignment.zoku_id,
            assignment.role
          );
        } catch (error) {
          this.logger.warn('Failed to assign initial zoku', undefined, {
            zoku_id: assignment.zoku_id,
            role: assignment.role,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    return entanglement;
  }

  /**
   * Update entanglement
   */
  async update(id: string, input: unknown): Promise<Entanglement> {
    this.requireTier('entangled');

    // Validate input
    const data = this.validate(updateEntanglementSchema, input);

    // Check entanglement exists
    const entanglement = await this.db.getEntanglement(id);
    if (!entanglement) {
      throw new NotFoundError('Entanglement', id);
    }

    // Validate parent if being changed
    if (data.parent_id !== undefined && data.parent_id !== null) {
      const parent = await this.db.getEntanglement(data.parent_id);
      if (!parent) {
        throw new NotFoundError('Parent entanglement', data.parent_id);
      }

      // Check for circular reference
      const descendants = await this.db.getEntanglementDescendants(id);
      if (descendants.some(d => d.id === data.parent_id)) {
        throw new ValidationError('Cannot set parent: would create circular reference');
      }
    }

    // Update
    await this.db.updateEntanglement(id, data);

    // Return updated
    const updated = await this.db.getEntanglement(id);
    return updated!;
  }

  /**
   * Delete entanglement
   */
  async delete(id: string, confirm = false): Promise<void> {
    this.requireTier('entangled');

    if (!confirm) {
      throw new ValidationError('Must set confirm=true to delete entanglement');
    }

    const entanglement = await this.db.getEntanglement(id);
    if (!entanglement) {
      throw new NotFoundError('Entanglement', id);
    }

    await this.db.deleteEntanglement(id);
  }

  /**
   * Move entanglement to new parent
   */
  async move(id: string, newParentId: string | null): Promise<void> {
    this.requireTier('entangled');

    const entanglement = await this.db.getEntanglement(id);
    if (!entanglement) {
      throw new NotFoundError('Entanglement', id);
    }

    // Validate new parent if provided
    if (newParentId !== null) {
      const parent = await this.db.getEntanglement(newParentId);
      if (!parent) {
        throw new NotFoundError('Parent entanglement', newParentId);
      }

      // Check circular reference
      const descendants = await this.db.getEntanglementDescendants(id);
      if (descendants.some(d => d.id === newParentId)) {
        throw new ValidationError('Cannot move: would create circular reference');
      }
    }

    await this.db.updateEntanglement(id, { parent_id: newParentId });
  }

  /**
   * Get PASCI matrix
   */
  async getMatrix(entanglementId: string) {
    const entanglement = await this.db.getEntanglement(entanglementId);
    if (!entanglement) {
      throw new NotFoundError('Entanglement', entanglementId);
    }

    return this.db.getMatrix(entanglementId);
  }

  /**
   * Assign zoku to PASCI role
   */
  async assignToMatrix(entanglementId: string, input: unknown): Promise<void> {
    this.requireTier('entangled');

    const data = this.validate(assignToMatrixSchema, input);

    // Verify entanglement exists
    const entanglement = await this.db.getEntanglement(entanglementId);
    if (!entanglement) {
      throw new NotFoundError('Entanglement', entanglementId);
    }

    // Verify zoku exists
    const zoku = await this.db.getZoku(data.zoku_id);
    if (!zoku) {
      throw new NotFoundError('Zoku', data.zoku_id);
    }

    // Validate accountable constraint (warn only)
    if (data.role === 'accountable') {
      const matrix = await this.db.getMatrix(entanglementId);
      if (matrix.accountable.length > 0 && !matrix.accountable.some(e => e.id === data.zoku_id)) {
        this.logger.warn('Multiple accountable entities', undefined, {
          entanglement_id: entanglementId,
          existing: matrix.accountable.map(z => z.id),
          new: data.zoku_id
        });
      }
    }

    await this.db.assignToMatrix(entanglementId, data.zoku_id, data.role);
  }

  /**
   * Remove zoku from PASCI role
   */
  async removeFromMatrix(entanglementId: string, zokuId: string, role: string): Promise<void> {
    this.requireTier('entangled');

    // Check if removing last accountable
    if (role === 'accountable') {
      const matrix = await this.db.getMatrix(entanglementId);
      if (matrix.accountable.length === 1 && matrix.accountable[0].id === zokuId) {
        throw new ValidationError(
          'Cannot remove last Accountable. Entanglement must have exactly one Accountable.'
        );
      }
    }

    await this.db.removeFromMatrix(entanglementId, zokuId, role);
  }
}
```

### Phase 3: Create Other Services (6 hours)

Following the same pattern, create:

**`src/services/zoku.ts`** (~2 hours):
- `list()` - List zoku
- `get(id)` - Get zoku details
- `create(input)` - Create zoku (entangled+)
- `update(id, input)` - Update zoku
- `delete(id)` - Delete zoku
- `updateTier(id, tier)` - Update access tier (prime only)

**`src/services/qupts.ts`** (~1.5 hours):
- `list(filters)` - List qupts
- `get(id)` - Get single qupt
- `create(input)` - Create qupt (entangled+)
- `batchCreate(inputs)` - Batch create qupts
- `delete(id)` - Delete qupt (entangled+)

**`src/services/jewels.ts`** (~1.5 hours):
- `list(filters)` - List jewels (ownership filtering)
- `get(id)` - Get jewel (no encrypted data)
- `create(input)` - Create jewel with validation (coherent+)
- `update(id, input)` - Update jewel (ownership check)
- `delete(id)` - Delete jewel (check not in use)
- `getUsage(id)` - Get jewel usage

**`src/services/sources.ts`** (~1 hour):
- `list(entanglementId)` - List sources
- `get(id)` - Get source details
- `create(entanglementId, input)` - Create source (entangled+)
- `update(id, input)` - Update source (entangled+)
- `delete(id)` - Delete source (entangled+)
- `sync(id)` - Trigger manual sync (entangled+)

**Export all services in `src/services/index.ts`**:
```typescript
export * from './base';
export * from './entanglements';
export * from './zoku';
export * from './qupts';
export * from './jewels';
export * from './sources';
```

### Phase 4: Update REST API Routes (2 hours)

Update all REST API routes to use services instead of direct DB access.

**Before** (`src/api/entanglements.ts`):
```typescript
app.post('/', requireTier('entangled'), async (c) => {
  const db = new DB(c.env.DB);
  const body = await validateBody(c, createEntanglementSchema);

  // Verify parent exists
  if (body.parent_id) {
    const parent = await db.getEntanglement(body.parent_id);
    if (!parent) {
      throw new NotFoundError('Parent entanglement', body.parent_id);
    }
  }

  const entanglement = await db.createEntanglement({
    name: body.name,
    description: body.description,
    parent_id: body.parent_id
  });

  // Assign initial zoku...
  
  return c.json(entanglement, 201);
});
```

**After** (using service):
```typescript
app.post('/', async (c) => {
  const db = new DB(c.env.DB);
  const user = c.get('user') as Zoku;
  const logger = c.get('logger') as Logger;
  const requestId = c.get('request_id') as string;
  
  const service = new EntanglementService(db, user, logger, requestId);
  const body = await c.req.json();
  
  const entanglement = await service.create(body);
  return c.json(entanglement, 201);
});
```

**Changes:**
- ✅ Remove `requireTier()` middleware (service handles it)
- ✅ Remove `validateBody()` call (service validates)
- ✅ Remove business logic (service handles it)
- ✅ Just create service and call method
- ✅ Service throws errors, error handler catches

**Apply to all REST routes:**
- `src/api/entanglements.ts` - 8 endpoints
- `src/api/zoku.ts` - 5 endpoints
- `src/api/qupts.ts` - 4 endpoints
- `src/api/jewels.ts` - 5 endpoints
- `src/api/sources.ts` - 4 endpoints

### Phase 5: Update MCP Tools (2 hours)

Update all 29 MCP tools to use services.

**Before**:
```typescript
server.tool('create_entanglement', 'Create entanglement', schema, async (args) => {
  const db = new DB(env.DB);
  
  // Validation
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
  
  // Assign PASCI...
  
  return { entanglement };
});
```

**After**:
```typescript
server.tool('create_entanglement', 'Create entanglement', schema, async (args, { db, user, logger, requestId }) => {
  const service = new EntanglementService(db, user, logger, requestId);
  const entanglement = await service.create(args);
  return { entanglement };
});
```

**Reduction: ~30 lines → 3 lines per tool!**

Update context provider in `src/mcp/server.ts`:
```typescript
const transport = new StreamableHTTPTransport('/mcp', server, {
  db,
  env,
  logger,
  user,
  requestId // Pass to tools
});
```

### Phase 6: Testing (2 hours)

**Unit Tests** (create `tests/services/entanglements.test.ts`):
```typescript
import { EntanglementService } from '../../src/services/entanglements';
import { DB } from '../../src/db';
import { Logger } from '../../src/lib/logger';
import { NotFoundError, ValidationError, ForbiddenError } from '../../src/lib/errors';

describe('EntanglementService', () => {
  let service: EntanglementService;
  let mockDb: jest.Mocked<DB>;
  let mockUser: Zoku;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockUser = { id: 'user-1', access_tier: 'entangled' } as Zoku;
    mockLogger = createMockLogger();
    service = new EntanglementService(mockDb, mockUser, mockLogger);
  });

  describe('create', () => {
    it('should create entanglement with valid input', async () => {
      const input = { name: 'Test', description: 'Description' };
      const result = await service.create(input);
      
      expect(result.name).toBe('Test');
      expect(mockDb.createEntanglement).toHaveBeenCalledWith(input);
    });

    it('should reject empty name', async () => {
      await expect(service.create({ name: '' })).rejects.toThrow(ZodError);
    });

    it('should reject if not entangled tier', async () => {
      mockUser.access_tier = 'coherent';
      await expect(service.create({ name: 'Test' })).rejects.toThrow(ForbiddenError);
    });

    it('should verify parent exists', async () => {
      mockDb.getEntanglement.mockResolvedValue(null);
      await expect(
        service.create({ name: 'Test', parent_id: 'bad-id' })
      ).rejects.toThrow(NotFoundError);
    });
  });
});
```

**Integration Tests**:
- Test REST API → Service → DB flow
- Test MCP Tool → Service → DB flow
- Verify both paths produce same results

### Phase 7: Documentation (1 hour)

Update documentation:
- `README.md` - Mention service layer
- `CLAUDE.md` - Update architecture section
- Create `docs/SERVICES_API.md` - Document all service methods

---

## Code Size Comparison

### Before (Current)

```
REST API routes:     ~800 lines (validation + business logic)
MCP tool handlers:  ~1600 lines (validation + business logic)
Total:              ~2400 lines
```

### After (With Services)

```
Services:            ~1200 lines (validation + business logic)
REST API routes:      ~300 lines (thin wrappers)
MCP tool handlers:    ~300 lines (thin wrappers)
Total:               ~1800 lines (25% reduction)
```

**Benefits:**
- 📉 25% less code (600 lines removed)
- ✅ Zero duplication
- ✅ Single validation path
- ✅ Testable business logic
- ✅ Both REST and MCP use same code

---

## Timeline

### Week 1 (8 hours)
- **Day 1**: Base service + EntanglementService (3 hours)
- **Day 2**: ZokuService + QuptService (3 hours)
- **Day 3**: JewelService + SourceService (2 hours)

### Week 2 (8 hours)
- **Day 1**: Update REST API routes (2 hours)
- **Day 2**: Update MCP tools (2 hours)
- **Day 3**: Testing + documentation (4 hours)

**Total: 16 hours over 2 weeks**

---

## Migration Strategy

### Option A: Big Bang (Not Recommended)
- Migrate everything at once
- High risk
- Long deployment delay

### Option B: Gradual Migration (Recommended)

**Step 1: Create Services** (Week 1)
- Create all service classes
- Keep REST API and MCP unchanged
- Services exist but aren't used yet

**Step 2: Migrate REST API** (Week 2, Day 1-2)
- Update REST routes one by one
- Test each route after migration
- Keep MCP using old approach

**Step 3: Migrate MCP** (Week 2, Day 3-4)
- Update MCP tools one by one
- Test each tool after migration
- Both now use services!

**Step 4: Cleanup** (Week 2, Day 5)
- Remove duplicate code
- Update documentation
- Final testing

**Benefits:**
- ✅ Lower risk (incremental)
- ✅ Can ship at any point
- ✅ Easy to rollback
- ✅ Test as you go

---

## Testing Checklist

### Service Unit Tests
- [ ] Validation works (rejects invalid inputs)
- [ ] Authorization works (tier checks)
- [ ] Business logic works (all rules enforced)
- [ ] Errors thrown correctly (NotFoundError, ValidationError, etc.)
- [ ] Audit logging works

### REST API Integration Tests
- [ ] POST /api/entanglements (valid data works)
- [ ] POST /api/entanglements (invalid data rejected)
- [ ] POST /api/entanglements (tier check enforced)
- [ ] PATCH /api/entanglements/:id (works)
- [ ] DELETE /api/entanglements/:id (works)
- [ ] Repeat for all endpoints

### MCP Integration Tests
- [ ] create_entanglement (valid data works)
- [ ] create_entanglement (invalid data rejected)
- [ ] create_entanglement (tier check enforced)
- [ ] update_entanglement (works)
- [ ] delete_entanglement (works)
- [ ] Repeat for all 29 tools

### Consistency Tests
- [ ] REST API and MCP produce same results
- [ ] REST API and MCP enforce same validation
- [ ] REST API and MCP enforce same tiers
- [ ] Errors formatted correctly in both

---

## Success Criteria

✅ **All services created** (5 files, ~1200 lines)
✅ **REST API migrated** (thin wrappers, ~300 lines)
✅ **MCP migrated** (thin wrappers, ~300 lines)
✅ **Zero validation duplication** (single path)
✅ **All tests passing** (unit + integration)
✅ **Code reduction** (25% less code)
✅ **Build succeeds** (no TypeScript errors)
✅ **Documentation updated** (architecture docs)

---

## Next Steps

1. **Review this plan** with team
2. **Get approval** to proceed
3. **Start Week 1** - Create services
4. **Start Week 2** - Migrate REST + MCP
5. **Test thoroughly** - All endpoints
6. **Deploy** - Ship with confidence!

---

## 🚀 IMPLEMENTATION IN PROGRESS

### Completed
- ✅ **BaseService** created (`src/services/base.ts`)
- ✅ **EntanglementService** created (`src/services/entanglements.ts`)

### In Progress
- 🔄 Creating remaining services (Zoku, Qupt, Jewel, Source)

### Next Steps
1. Complete remaining services
2. Migrate REST API routes
3. Migrate MCP tools
4. Test and build
5. Commit final changes

---

*Plan created: December 16, 2025*  
*Estimated effort: 16 hours over 2 weeks*  
*Code reduction: 25% (600 lines)*  
*Benefits: Single validation path, zero duplication, testable*  
**Status: IMPLEMENTING NOW - BIG BANG MIGRATION**
