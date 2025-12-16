# The Great Game: Complete Terminology Refactoring Plan

## Overview
Comprehensive renaming of all terminology across the entire codebase:
- **volition** → **entanglement** (projects/initiatives)
- **entangled** → **zoku** (people/entities)
- **credential** → **jewel** (auth tokens)
- **Zoku** (system name) → **The Great Game**

**Approach:** Clean break - no backwards compatibility, fresh database
**Scope:** 45+ files, 150+ references
**Strategy:** Bottom-up (database → types → backend → frontend → docs)

---

## Phase 1: Database Schema (Foundation)

### 1.1 Update schema.sql
**File:** `schema.sql`

**Table Renames:**
```sql
-- Core tables
volitions → entanglements
entangled → zoku
credentials → jewels

-- Junction/relationship tables
volition_entangled → entanglement_zoku
volition_attributes → entanglement_attributes
```

**Column Renames:**
```sql
-- In all tables
volition_id → entanglement_id
entangled_id → zoku_id
credential_id → jewel_id
entangled_at → linked_at
```

**Index Renames:**
```sql
idx_volitions_parent → idx_entanglements_parent
idx_volition_entangled_volition → idx_entanglement_zoku_entanglement
idx_volition_attributes_volition → idx_entanglement_attributes_entanglement
idx_credentials_type → idx_jewels_type
idx_sources_volition → idx_sources_entanglement
idx_sources_credential → idx_sources_jewel
idx_qupts_volition → idx_qupts_entanglement
```

**Trigger Renames:**
```sql
volitions_updated_at → entanglements_updated_at
credentials_updated_at → jewels_updated_at
```

**Foreign Key Updates:**
- Self-reference: `entanglements(parent_id) REFERENCES entanglements(id)`
- Cross-table: All FKs updated to reference new table/column names

### 1.2 Update migrations/002_add_credentials.sql
**Rename to:** `migrations/002_add_jewels.sql`

**Changes:**
- `CREATE TABLE credentials` → `CREATE TABLE jewels`
- `ALTER TABLE sources_new ADD COLUMN credential_id` → `jewel_id`
- All index names: `idx_credentials_*` → `idx_jewels_*`
- Trigger: `credentials_updated_at` → `jewels_updated_at`

### 1.3 Update migrations/003_add_entangled_description.sql
**Rename to:** `migrations/003_add_zoku_description.sql`

**Changes:**
- `ALTER TABLE entangled` → `ALTER TABLE zoku`

### 1.4 Update migrations/004_add_source_errors.sql
**No file rename needed**

**Changes:**
- Table name in comments (if any references to volitions/entangled)

### 1.5 Update seed.sql
**File:** `seed.sql`

**Changes:**
- All INSERT statements use new table names
- `INSERT INTO dimensions` (no change)
- `INSERT INTO dimension_values` (no change)

### 1.6 Reset local database
**Command:** `npm run db:reset`
- This will recreate database with new schema
- Fresh start per user request

---

## Phase 2: TypeScript Types (Contracts)

### 2.1 Backend Types
**File:** `src/types.ts`

**Interface Renames:**
```typescript
interface Volition → interface Entanglement {
  parent_id?: string  // Keep same (refers to parent entanglement)
}

interface Entangled → interface Zoku {
  // All properties keep same structure
}

interface Credential → interface Jewel {
  // All properties keep same structure
}

interface VolitionAttribute → interface EntanglementAttribute {
  volition_id → entanglement_id
}

interface Source {
  volition_id → entanglement_id
  credential_id → jewel_id
}

interface Qupt {
  volition_id → entanglement_id
  entangled_id → zoku_id
}
```

### 2.2 Frontend Types
**File:** `frontend/src/lib/types.ts`

**Same interface renames as backend**
**Plus:**
```typescript
interface PASCIMatrix {
  perform: Entangled[] → Zoku[]
  accountable: Entangled[] → Zoku[]
  // etc.
}
```

---

## Phase 3: Database Access Layer

### 3.1 Update DB class
**File:** `src/db.ts` (806 lines - extensive changes)

**Method Renames (40+ methods):**

**Volition → Entanglement:**
- `getVolition()` → `getEntanglement()`
- `listVolitions()` → `listEntanglements()`
- `createVolition()` → `createEntanglement()`
- `updateVolition()` → `updateEntanglement()`
- `deleteVolition()` → `deleteEntanglement()`
- `getVolitionChildren()` → `getEntanglementChildren()`
- `getVolitionDescendants()` → `getEntanglementDescendants()`
- `getVolitionChildrenCount()` → `getEntanglementChildrenCount()`
- `getVolitionQuptsCount()` → `getEntanglementQuptsCount()`
- `getVolitionSourcesCount()` → `getEntanglementSourcesCount()`
- `getVolitionEntangledCount()` → `getEntanglementZokuCount()`
- `getVolitionAttributes()` → `getEntanglementAttributes()`
- `setVolitionAttributes()` → `setEntanglementAttributes()`
- `addVolitionAttribute()` → `addEntanglementAttribute()`
- `removeVolitionAttributes()` → `removeEntanglementAttributes()`
- `getVolitionsAttributes()` → `getEntanglementsAttributes()`

**Entangled → Zoku:**
- `getEntangled()` → `getZoku()`
- `listEntangled()` → `listZoku()`
- `createEntangled()` → `createZoku()`
- `updateEntangled()` → `updateZoku()`
- `deleteEntangled()` → `deleteZoku()`
- `getEntangledVolitions()` → `getZokuEntanglements()`

**Credential → Jewel:**
- `createCredential()` → `createJewel()`
- `getCredential()` → `getJewel()`
- `listCredentials()` → `listJewels()`
- `updateCredential()` → `updateJewel()`
- `deleteCredential()` → `deleteJewel()`
- `getCredentialUsage()` → `getJewelUsage()`

**Matrix methods:**
- `getMatrix()` - Keep name but update queries
- `assignToMatrix()` - Update queries (entanglement_zoku table)
- `removeFromMatrix()` - Update queries

**All SQL queries in methods:**
- Table names: `volitions` → `entanglements`, `entangled` → `zoku`, `credentials` → `jewels`
- Column names: `volition_id` → `entanglement_id`, `entangled_id` → `zoku_id`, `credential_id` → `jewel_id`

---

## Phase 4: Backend API Routes

### 4.1 Rename API route files
**File renames:**
- `src/api/volitions.ts` → `src/api/entanglements.ts`
- `src/api/entangled.ts` → `src/api/zoku.ts`
- `src/api/credentials.ts` → `src/api/jewels.ts`

### 4.2 Update route mounting
**File:** `src/index.ts`

**Changes:**
```typescript
// Import renames
import volitionsRoutes from './api/volitions' → import entanglementsRoutes from './api/entanglements'
import entangledRoutes from './api/entangled' → import zokuRoutes from './api/zoku'
import credentialsRoutes from './api/credentials' → import jewelsRoutes from './api/jewels'

// Route mounting
app.route('/api/volitions', volitionsRoutes) → app.route('/api/entanglements', entanglementsRoutes)
app.route('/api/entangled', entangledRoutes) → app.route('/api/zoku', zokuRoutes)
app.route('/api/credentials', credentialsRoutes) → app.route('/api/jewels', jewelsRoutes)
```

### 4.3 Update each API route file

**In entanglements.ts (formerly volitions.ts):**
- All Hono route paths
- All DB method calls (use new names)
- All type references (Volition → Entanglement)
- All variable names (volition → entanglement, volitionId → entanglementId)
- All response field names
- All error messages

**In zoku.ts (formerly entangled.ts):**
- Same pattern for zoku

**In jewels.ts (formerly credentials.ts):**
- Same pattern for jewels

**In sources.ts:**
- Update volition_id → entanglement_id references
- Update credential_id → jewel_id references
- Update DB method calls

**In qupts.ts:**
- Update volition_id → entanglement_id references
- Update entangled_id → zoku_id references
- Update DB method calls

---

## Phase 5: MCP Server

### 5.1 Update MCP tool definitions
**File:** `src/mcp/server.ts`

**29 tools to update:**

**Tool name changes:**
```typescript
list_volitions → list_entanglements
get_volition → get_entanglement
create_volition → create_entanglement
update_volition → update_entanglement
move_volition → move_entanglement
delete_volition → delete_entanglement
get_children → get_child_entanglements

list_entangled → list_zoku
create_entangled → create_zoku
get_entangled → get_zoku

entangle → link_zoku_to_entanglement
disentangle → unlink_zoku_from_entanglement

add_credential → add_jewel
list_credentials → list_jewels
get_credential → get_jewel
update_credential → update_jewel
delete_credential → delete_jewel
get_credential_usage → get_jewel_usage
```

**Zod schema updates:**
- All parameter names: `volition_id` → `entanglement_id`, `entangled_id` → `zoku_id`, `credential_id` → `jewel_id`
- All descriptions mentioning old terminology

**Handler implementations:**
- All DB method calls use new names
- All variable renames
- All response field renames

---

## Phase 6: Source Handlers

### 6.1 Update handler implementations
**Files:** `src/handlers/*.ts`

**Changes in each handler:**
- Variable names: `volitionId` → `entanglementId`
- Metadata field names in qupts
- Log messages
- Error messages

**Specific files:**
- `src/handlers/github.ts`
- `src/handlers/zammad.ts`
- `src/handlers/gdrive.ts`
- `src/handlers/google-auth.ts` (minimal changes)
- `src/handlers/validate.ts` (credential → jewel references)
- `src/handlers/index.ts` (type references)

### 6.2 Update scheduled handler
**File:** `src/scheduled.ts`

**Changes:**
- DB method calls
- Variable names
- Log messages

---

## Phase 7: Frontend - API Client

### 7.1 Update API client
**File:** `frontend/src/lib/api.ts`

**Method renames (40+ methods):**
```typescript
listVolitions() → listEntanglements()
getVolition() → getEntanglement()
createVolition() → createEntanglement()
updateVolition() → updateEntanglement()
deleteVolition() → deleteEntanglement()
getMatrix() → getZokuMatrix()
assignToMatrix() → linkZokuToEntanglement()
removeFromMatrix() → unlinkZokuFromEntanglement()
getVolitionAttributes() → getEntanglementAttributes()
setVolitionAttributes() → setEntanglementAttributes()

listEntangled() → listZoku()
getEntangled() → getZoku()
createEntangled() → createZoku()
updateEntangled() → updateZoku()
deleteEntangled() → deleteZoku()

listCredentials() → listJewels()
createCredential() → createJewel()
getCredential() → getJewel()
updateCredential() → updateJewel()
deleteCredential() → deleteJewel()
```

**Fetch paths:**
```typescript
fetch(`/api/volitions/${id}`) → fetch(`/api/entanglements/${id}`)
fetch(`/api/entangled/${id}`) → fetch(`/api/zoku/${id}`)
fetch(`/api/credentials/${id}`) → fetch(`/api/jewels/${id}`)
```

**Type annotations:**
- All method return types updated
- All parameter types updated

---

## Phase 8: Frontend - Components

### 8.1 Rename component files

**File renames:**
```
VolitionsList.tsx → EntanglementsList.tsx
VolitionCard.tsx → EntanglementCard.tsx
VolitionDetail.tsx → EntanglementDetail.tsx
EntangledList.tsx → ZokuList.tsx
EntangledDetail.tsx → ZokuDetail.tsx
CredentialsList.tsx → JewelsList.tsx
```

### 8.2 Update App.tsx routing
**File:** `frontend/src/App.tsx`

**Changes:**
- Import statements (component renames)
- Type aliases
- State variables: `selectedVolitionId` → `selectedEntanglementId`, `selectedEntangledId` → `selectedZokuId`
- URL parameters: `?volition=` → `?entanglement=`, `?entangled=` → `?zoku=`
- View names: `'volitions'` → `'entanglements'`, `'entangled'` → `'zoku'`, `'credentials'` → `'jewels'`
- Handler names: `handleSelectVolition` → `handleSelectEntanglement`, `handleSelectEntangled` → `handleSelectZoku`
- Query keys: `['volitions']` → `['entanglements']`, `['entangled']` → `['zoku']`, `['credentials']` → `['jewels']`

### 8.3 Update Dashboard.tsx
**File:** `frontend/src/components/Dashboard.tsx`

**Changes:**
- Component imports (EntanglementCard instead of VolitionCard)
- API calls: `api.listVolitions()` → `api.listEntanglements()`
- Type annotations: `Volition[]` → `Entanglement[]`
- Variable names: `volitions` → `entanglements`, `entangled` → `zoku`, `credentials` → `jewels`
- Query keys
- UI text: "Active Volitions" → "Active Entanglements", "Total Entangled" → "Total Zoku", "Credentials" → "Jewels"
- Click handlers

### 8.4 Update EntanglementsList.tsx (formerly VolitionsList)
**File:** `frontend/src/components/EntanglementsList.tsx`

**Changes:**
- Component prop types
- API calls
- Variable names throughout
- UI text: all headings, labels, buttons
- Query keys
- Import EntanglementCard

### 8.5 Update EntanglementDetail.tsx (formerly VolitionDetail)
**Changes:**
- Type annotations
- API calls to entanglements/zoku/jewels
- Component references (AddSourceForm, AttributeEditor)
- UI text: all labels and headings
- Variable names

### 8.6 Update ZokuList.tsx (formerly EntangledList)
**Changes:**
- Type: `Entangled` → `Zoku`
- API calls
- Variable names
- UI text: "Entangled" → "Zoku", "All Partners" → "All Zoku"
- Responsibility Matrix column headers

### 8.7 Update ZokuDetail.tsx (formerly EntangledDetail)
**Changes:**
- Type annotations
- API calls: `api.getEntangled()` → `api.getZoku()`, `api.updateEntangled()` → `api.updateZoku()`
- Variable names
- UI text and labels
- Field names (if any reference "entangled" vs "zoku")

### 8.8 Update JewelsList.tsx (formerly CredentialsList)
**Changes:**
- Type: `Credential` → `Jewel`
- API calls: `api.listCredentials()` → `api.listJewels()`
- Variable names
- UI text: "Credentials" → "Jewels", "Add Credential" → "Add Jewel", "Stored Credentials" → "Stored Jewels"
- Form labels

### 8.9 Update other components

**ActivityList.tsx:**
- Type imports
- API calls
- Variable names: `selectedVolition` → `selectedEntanglement`
- Filter labels

**SourcesList.tsx:**
- Type imports
- Variable names
- jewel references in source display

**QuptItem.tsx:**
- Type imports
- Props: `volitionName` → `entanglementName` (if exists)
- Display logic

**AddSourceForm.tsx:**
- Type imports
- Form fields: `volition_id` → `entanglement_id`, `credential_id` → `jewel_id`
- Labels: "Credential" → "Jewel", "Volition" → "Entanglement"
- API calls

**EditSourceForm.tsx:**
- Same as AddSourceForm

**AttributeEditor.tsx:**
- Props: `volitionId` → `entanglementId`
- API calls
- Query keys

**GoogleOAuthButton.tsx:**
- Minimal - mainly type imports

---

## Phase 9: Documentation

### 9.1 Update CLAUDE.md
**File:** `CLAUDE.md`

**Major sections to rewrite:**

**Header/Title:**
- "Zoku - Claude Context" → "The Great Game - Claude Context"

**Project Overview:**
- "Zoku is a project/initiative tracking system" → "The Great Game is a project/initiative tracking system"

**Core Concepts:**
```
- Volition → Entanglement: A project/initiative (can be nested)
- Entangled → Zoku: Partner/entity (human or AI agent)
- Credential → Jewel: API tokens and OAuth connections
```

**MCP Tools Available:**
- All 29 tool names
- All descriptions
- All examples

**API Endpoints:**
- All paths updated
- All descriptions

**Frontend Features:**
- All page names
- All component names
- All UI text examples

**Development Commands:**
- Package names if they change

**Notes for Future Claude Sessions:**
- All terminology references

### 9.2 Update README.md
**Similar comprehensive updates:**
- System name
- Core concepts
- API reference
- MCP tools
- Feature descriptions

---

## Phase 10: Configuration & Build

### 10.1 Update package.json
**File:** `package.json`

**Changes:**
- `"name": "zoku"` → `"name": "the-great-game"`
- Description if it mentions Zoku
- Script descriptions if any

### 10.2 Update frontend package.json
**File:** `frontend/package.json`

**Changes:**
- `"name": "zoku-frontend"` → `"name": "the-great-game-frontend"`

### 10.3 Update wrangler.toml
**File:** `wrangler.toml`

**Changes:**
- `name = "zoku"` → `name = "the-great-game"`
- Database name: `database_name = "zoku"` → `database_name = "the-great-game"`

---

## Implementation Order (Critical Path)

### Step 1: Database Foundation (do first)
1. Update `schema.sql` (table/column/index names)
2. Rename and update all migration files
3. Update `seed.sql`
4. Run `npm run db:reset` to recreate with new schema

### Step 2: Type System (enables everything else)
1. Update `src/types.ts` (backend types)
2. Update `frontend/src/lib/types.ts` (frontend types)

### Step 3: Database Layer (data access)
1. Update `src/db.ts` (all method names and SQL queries)

### Step 4: Backend API (REST endpoints)
1. Rename `src/api/volitions.ts` → `src/api/entanglements.ts`
2. Rename `src/api/entangled.ts` → `src/api/zoku.ts`
3. Rename `src/api/credentials.ts` → `src/api/jewels.ts`
4. Update `src/api/sources.ts` (references only)
5. Update `src/api/qupts.ts` (references only)
6. Update `src/index.ts` (route mounting)

### Step 5: MCP Server (AI interface)
1. Update `src/mcp/server.ts` (29 tool definitions)

### Step 6: Source Handlers
1. Update all files in `src/handlers/` (references only)
2. Update `src/scheduled.ts`

### Step 7: Frontend API Client
1. Update `frontend/src/lib/api.ts` (all method names and paths)

### Step 8: Frontend Components
1. Rename 6 component files
2. Update `frontend/src/App.tsx` (routing and state)
3. Update `Dashboard.tsx`
4. Update all other components (imports and references)

### Step 9: Documentation
1. Update `CLAUDE.md`
2. Update `README.md`

### Step 10: Configuration
1. Update `package.json`
2. Update `frontend/package.json`
3. Update `wrangler.toml`

### Step 11: Testing & Verification
1. Run `npm run db:reset` to verify schema
2. Start backend (`npm run dev`)
3. Start frontend (`cd frontend && npm run dev`)
4. Test all pages load
5. Test creating entanglement/zoku/jewel
6. Test MCP tools work
7. Run build to verify TypeScript compiles

---

## Risk Mitigation

**High Risk Areas:**
1. **Database migration** - Fresh start means data loss (acceptable per user)
2. **Type errors** - Comprehensive change means many compile errors initially
3. **Broken links** - Old URLs won't work (clean break is intentional)
4. **MCP clients** - Any saved Claude Desktop configs will break (acceptable)

**Mitigation Strategy:**
- Work in order (database → types → backend → frontend)
- Verify TypeScript compiles after each phase
- Test endpoints after backend updates
- Test UI after frontend updates

**Rollback Plan:**
- Create git branch before starting: `git checkout -b rename-to-great-game`
- Can revert if issues found
- Commit after each phase for granular rollback

---

## Critical Files Summary

**Must modify (in order):**
1. `schema.sql` - Foundation
2. `migrations/*.sql` - All 3 migration files
3. `seed.sql` - Test data
4. `src/types.ts` - Type definitions
5. `frontend/src/lib/types.ts` - Frontend types
6. `src/db.ts` - Database layer (largest file)
7. `src/api/*.ts` - All 6 API route files
8. `src/mcp/server.ts` - MCP tools
9. `src/index.ts` - Route mounting
10. `frontend/src/lib/api.ts` - Frontend API client
11. `frontend/src/App.tsx` - Frontend routing
12. `frontend/src/components/*.tsx` - All 14 components
13. `CLAUDE.md` - Comprehensive docs
14. `README.md` - User docs
15. `package.json` - Config
16. `wrangler.toml` - Deployment config

**Total files:** ~45 files requiring modifications

---

## Execution Strategy

**Estimated time:** 3-4 hours for complete refactoring
**Approach:** Bottom-up (database first, then propagate up through types → backend → frontend)
**Verification:** TypeScript compiler will catch most errors
**Testing:** Manual testing after completion

**Git strategy:**
```bash
git checkout -b rename-to-great-game
# Make all changes
git add .
git commit -m "Rename terminology: The Great Game, Entanglements, Zoku, Jewels"
git push origin rename-to-great-game
# If verified working:
git checkout main
git merge rename-to-great-game
```
