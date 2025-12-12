# MCP Server Implementation Review

**Date:** 2025-12-12
**Status:** Post-Migration to Official SDK v1.24.3

## Executive Summary

Comprehensive review of the MCP server implementation in `src/mcp/server.ts` after migration to the official SDK. Found 15 issues ranging from critical performance problems to minor inconsistencies.

**Critical Issues:** 2
**High Priority:** 4
**Medium Priority:** 6
**Low Priority:** 3

---

## Critical Issues

### 1. N+1 Query Problem in list_entanglements ✅ FIXED
**Location:** Lines 209-228
**Severity:** CRITICAL - Performance
**Status:** Fixed in commit [pending]

```typescript
const entanglementsWithCounts = await Promise.all(
  entanglements.map(async v => {
    const qupts_count = (await db.listQupts({ entanglement_id: v.id, recursive: true, limit: 1000 })).length;
    const sources_count = (await db.listSources(v.id)).length;
```

**Problem:**
Classic N+1 query problem. For 50 entanglements, this executes 100 additional database queries (2 per entanglement). With recursive qupts queries, this becomes extremely slow.

**Impact:**
- `list_entanglements` could take 5-10+ seconds with many entanglements
- Blocks the worker thread during execution
- Poor user experience

**Recommendation:**
Implement batch counting queries or add count columns to the entanglements table. Example:
```typescript
// Option 1: Single SQL query with subqueries
SELECT e.*,
  (SELECT COUNT(*) FROM qupts q WHERE q.entanglement_id = e.id) as qupts_count,
  (SELECT COUNT(*) FROM sources s WHERE s.entanglement_id = e.id) as sources_count
FROM entanglements e
```

### 2. Incorrect Count Calculation Using limit ✅ FIXED
**Location:** Line 211, 246
**Severity:** CRITICAL - Correctness
**Status:** Fixed in commit [pending]

```typescript
const qupts_count = (await db.listQupts({ entanglement_id: v.id, recursive: true, limit: 1000 })).length;
```

**Problem:**
Using `limit: 1000` then taking `.length` gives wrong counts if there are >1000 qupts. The count will be capped at 1000.

**Impact:**
- Incorrect qupts_count displayed to users
- Misleading metrics in dashboards

**Recommendation:**
Add a proper COUNT query method to the DB class:
```typescript
// In src/db.ts
async countQupts(entanglement_id: string, recursive: boolean): Promise<number> {
  const query = recursive
    ? `SELECT COUNT(*) as count FROM qupts WHERE entanglement_id IN (
         WITH RECURSIVE descendants AS (...)
       )`
    : `SELECT COUNT(*) as count FROM qupts WHERE entanglement_id = ?`;
  // ...
}
```

---

## High Priority Issues

### 3. Missing Source Sync Error Tracking
**Location:** Lines 543-600
**Severity:** HIGH - Operations

**Problem:**
When `sync_source` fails (line 574), the error is thrown to the client but not stored in the source record. No way to see historical sync failures or current error state.

**Impact:**
- No visibility into which sources are failing
- Frontend can't show error indicators
- No error messages for debugging

**Recommendation:**
Add `last_error` and `last_error_at` fields to sources table. Update on failure:
```typescript
try {
  const { qupts, cursor } = await handler.collect(...);
  await db.updateSource(source.id, {
    last_sync: now,
    sync_cursor: cursor,
    last_error: null,  // Clear error on success
    last_error_at: null
  });
} catch (error) {
  await db.updateSource(source.id, {
    last_error: error.message,
    last_error_at: Math.floor(Date.now() / 1000)
  });
  throw error;
}
```

### 4. Tool Name Inconsistency: get_volition
**Location:** Lines 21, 234, 828
**Severity:** HIGH - Developer Experience

**Problem:**
Tool is named `get_volition` but "volition" is the old terminology. Should be `get_entanglement` to match the renamed domain model.

**Impact:**
- Confusing for new developers/users
- Inconsistent with API endpoints (`/api/entanglements`)
- Mixed terminology in codebase

**Recommendation:**
Rename tool to `get_entanglement`. Keep backward compatibility if needed:
```typescript
// Register primary tool
server.tool('get_entanglement', ...);

// Optional: Keep deprecated alias
server.tool('get_volition', 'DEPRECATED: Use get_entanglement instead', ...);
```

### 5. Missing Source Config Validation
**Location:** Line 126
**Severity:** HIGH - Data Quality

**Problem:**
`config: z.record(z.any())` accepts any object. No validation that GitHub sources have `owner`/`repo`, Zammad has `url`/`tag`, etc.

**Impact:**
- Sources created with invalid config fail at sync time
- Poor error messages ("undefined is not a string")
- Database contains invalid data

**Recommendation:**
Use discriminated unions in Zod schema:
```typescript
add_source: z.object({
  entanglement_id: z.string(),
  type: z.enum(['github', 'zammad', 'gdocs', ...]),
  config: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('github'),
      owner: z.string(),
      repo: z.string(),
      events: z.array(z.string())
    }),
    z.object({
      type: z.literal('zammad'),
      url: z.string().url(),
      tag: z.string(),
      include_articles: z.boolean().optional()
    }),
    // ... other types
  ])
})
```

### 6. Unused Schema Fields
**Location:** Line 14, 202-206
**Severity:** HIGH - Code Quality

**Problem:**
`list_entanglements` schema includes `status` and `function` filters but they're never used in the handler. Parsed but ignored.

**Impact:**
- Users expect filtering to work but it doesn't
- Misleading API documentation

**Recommendation:**
Either implement the filters or remove from schema:
```typescript
// Option 1: Implement
const entanglements = await db.listEntanglements({
  parent_id: input.parent_id,
  root_only: input.root_only,
  status: input.status,        // Add these
  function: input.function,    // Add these
  limit: input.limit
});

// Option 2: Remove from schema
list_entanglements: z.object({
  parent_id: z.string().optional(),
  root_only: z.boolean().optional(),
  limit: z.number().optional(),
  detailed: z.boolean().optional()
  // Remove status and function if not implementing
}),
```

---

## Medium Priority Issues

### 7. Initial Sync Window Failure Handling
**Location:** Lines 525-531
**Severity:** MEDIUM - Operations

**Problem:**
If setting initial `last_sync` to 30 days ago fails (line 527), error is only logged as warning. Source will sync from epoch (1970), pulling decades of data.

**Impact:**
- Massive initial sync could timeout
- Creates thousands of unnecessary qupts
- Poor user experience on first sync

**Recommendation:**
Make initial sync window mandatory:
```typescript
const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
await db.updateSource(source.id, { last_sync: thirtyDaysAgo });
// Don't catch - let it fail if updateSource fails
```

### 8. Credentials vs Jewels Naming Inconsistency
**Location:** Line 127, 1134
**Severity:** MEDIUM - Developer Experience

**Problem:**
Tool uses `get_credential` but everywhere else calls them "jewels". Schema field is `credentials` but CLAUDE.md shows `jewels`.

**Impact:**
- Confusing terminology
- Inconsistent with documentation

**Recommendation:**
Standardize on "jewels":
```typescript
// Rename schema field
add_source: z.object({
  // ...
  jewels: z.record(z.any()).optional(),  // was: credentials
  jewel_id: z.string().optional()
})

// Rename tool
server.tool('get_jewel', ...)  // was: get_credential
```

### 9. Zod Schema Duplication
**Location:** Lines 11-173 vs 790-1169
**Severity:** MEDIUM - Maintainability

**Problem:**
Tool schemas defined twice - once as Zod schemas, once as SDK tool schemas. Must be kept in sync manually.

**Impact:**
- Easy to update one and forget the other
- Validation inconsistencies
- More code to maintain

**Recommendation:**
Generate SDK schemas from Zod or use a shared schema generator. Example:
```typescript
import { zodToJsonSchema } from 'zod-to-json-schema';

const zodSchema = schemas.list_entanglements;
const sdkSchema = zodToJsonSchema(zodSchema);
server.tool('list_entanglements', 'Description', sdkSchema, handler);
```

### 10. Google Docs Validation Without test_document_id
**Location:** Line 637
**Severity:** MEDIUM - User Experience

**Problem:**
Falls back to empty string if `test_document_id` not provided, which might cause validation to fail unnecessarily.

**Impact:**
- Cannot validate Google credentials without a test document
- User must provide test_document_id even if not needed

**Recommendation:**
Skip validation if test_document_id not provided:
```typescript
case 'gdocs':
case 'gdrive':
  if (input.data.test_document_id) {
    validationResult = await validateGoogleDocsSource(
      { document_id: input.data.test_document_id },
      input.data
    );
  } else {
    // Skip validation, just store credentials
    validationResult = { valid: true, warnings: [], errors: [] };
  }
  break;
```

### 11. No Timeout for Source Sync
**Location:** Lines 543-600
**Severity:** MEDIUM - Reliability

**Problem:**
`sync_source` could run indefinitely if fetching huge amounts of data or if external API is slow.

**Impact:**
- Worker timeout after 30 seconds (CPU limit)
- Partial sync leaves inconsistent state
- Poor user experience

**Recommendation:**
Add timeout and batch processing:
```typescript
// In handler.collect()
const SYNC_TIMEOUT = 25000; // 25 seconds (leave 5s buffer)
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), SYNC_TIMEOUT);

try {
  const { qupts, cursor, hasMore } = await handler.collect({
    signal: controller.signal,
    maxQupts: 1000  // Limit per sync
  });
  // Store hasMore flag for next sync
} finally {
  clearTimeout(timeout);
}
```

### 12. Generic Error Codes in mcpHandler
**Location:** Lines 1211-1218
**Severity:** MEDIUM - Developer Experience

**Problem:**
All errors return generic -32603 "Internal error" code. No distinction between different error types.

**Impact:**
- Hard to debug issues
- Clients can't handle specific errors differently

**Recommendation:**
Map error types to specific JSON-RPC codes:
```typescript
catch (error) {
  let code = -32603; // Internal error
  let message = error.message;

  if (error.name === 'ZodError') {
    code = -32602; // Invalid params
  } else if (error.message.includes('not found')) {
    code = -32001; // Resource not found (custom)
  } else if (error.message.includes('validation failed')) {
    code = -32002; // Validation error (custom)
  }

  return c.json({ jsonrpc: '2.0', id: null, error: { code, message } }, 500);
}
```

---

## Low Priority Issues

### 13. Overly Permissive Type Safety
**Location:** Lines 63, 82, 126, 127, 148
**Severity:** LOW - Code Quality

**Problem:**
Multiple `z.record(z.any())` usages bypass type checking for metadata, config, credentials, and data fields.

**Recommendation:**
Define more specific schemas where possible, at least for common fields.

### 14. Detailed Parameter Default Not Enforced
**Location:** Lines 18, 71, 819, 949
**Severity:** LOW - Consistency

**Problem:**
Schemas have `.optional()` but descriptions say "default: false". Zod doesn't enforce the default.

**Recommendation:**
Use `.default(false)` instead of `.optional()`:
```typescript
detailed: z.boolean().default(false)
```

### 15. Race Condition in Source Sync
**Location:** Lines 583-591
**Severity:** LOW - Edge Case

**Problem:**
If two sync operations run simultaneously for same source, both might fetch same data. Duplicate qupts would be rejected by unique constraint but one operation fails.

**Recommendation:**
Add distributed locking or rate limiting. For Cloudflare Workers, use Durable Objects or KV with check-and-set:
```typescript
// Before sync
const lockKey = `source-lock:${source.id}`;
const acquired = await env.KV.put(lockKey, '1', { expirationTtl: 60, condition: 'doesNotExist' });
if (!acquired) {
  throw new Error('Source sync already in progress');
}
```

---

## Testing Recommendations

1. **Performance Testing**
   - Test `list_entanglements` with 100+ entanglements
   - Measure query time for counts
   - Profile N+1 query impact

2. **Edge Case Testing**
   - Entanglements with >1000 qupts (test count accuracy)
   - Concurrent source syncs
   - Source sync failures and recovery
   - Invalid source configs

3. **Integration Testing**
   - All 29 tools via MCP protocol
   - Error handling and error codes
   - Validation for each source type

---

## Migration Priority

**Phase 1 (Critical - Do First):**
- Fix N+1 query problem (#1)
- Fix incorrect count calculation (#2)

**Phase 2 (High - Do Next):**
- Add source error tracking (#3)
- Rename get_volition → get_entanglement (#4)
- Add source config validation (#5)
- Implement or remove unused filters (#6)

**Phase 3 (Medium - Schedule Soon):**
- Fix initial sync window handling (#7)
- Standardize credentials vs jewels naming (#8)
- Add sync timeout (#11)
- Improve error codes (#12)

**Phase 4 (Low - As Time Permits):**
- Schema duplication (#9)
- Google docs validation (#10)
- Type safety improvements (#13-15)

---

## Conclusion

The MCP server implementation is functionally complete with all 29 tools working. However, critical performance issues (#1, #2) should be addressed before production deployment. The N+1 query problem could cause significant slowdowns with realistic data volumes.

High priority issues (#3-6) affect operations and developer experience but don't block functionality. Medium and low priority issues are quality-of-life improvements that can be addressed iteratively.

**Recommendation:** Address Phase 1 issues before production deployment.
