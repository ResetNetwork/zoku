# Comprehensive Integration Test Plan

## Overview

This document outlines a comprehensive integration test plan for the Zoku (The Great Game) application - a Cloudflare Worker-based project/initiative tracking system with MCP interface.

**Current State**: No existing tests. The project has zero test infrastructure.

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                        Clients                               │
├─────────────────────────┬───────────────────────────────────┤
│   Web UI (React/Vite)   │   MCP Clients (Claude Desktop)    │
└───────────┬─────────────┴─────────────────┬─────────────────┘
            │                               │
            │ HTTP/JSON                     │ MCP Protocol (HTTP)
            ▼                               ▼
┌───────────────────────────────────────────────────────────────┐
│                     Hono HTTP Server                          │
├─────────────────────────────────────────────────────────────────┤
│  Middleware Stack:                                             │
│  - CORS                                                        │
│  - Security Headers                                            │
│  - Logging                                                     │
│  - Error Handler                                               │
│  - Auth (CF Access JWT / MCP Token)                           │
├─────────────────────────────────────────────────────────────────┤
│  Routes:                                                        │
│  - /health (public)                                            │
│  - /oauth/* (public + protected)                               │
│  - /api/* (protected)                                          │
│  - /mcp (Bearer token auth)                                    │
└───────────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────┐
│                    Service Layer                               │
│  - EntanglementService (13 methods)                           │
│  - ZokuService (6 methods)                                     │
│  - QuptService (5 methods)                                     │
│  - JewelService (6 methods)                                    │
│  - SourceService (5 methods)                                   │
└───────────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────┐
│                    DB Layer (D1)                               │
│  Tables: entanglements, zoku, qupts, sources, jewels,         │
│          dimensions, dimension_values, entanglement_attributes,│
│          entanglement_zoku, audit_log                          │
└───────────────────────────────────────────────────────────────┘
```

## Recommended Test Framework

**Primary**: Vitest (native TypeScript, fast, Cloudflare Workers compatible)

```bash
npm install -D vitest @cloudflare/vitest-pool-workers miniflare
```

**Why Vitest**:
- Native TypeScript support
- Fast execution
- Built-in mocking
- `@cloudflare/vitest-pool-workers` provides D1, KV, and Durable Object mocking
- Compatible with Hono testing utilities

## Test Categories

### 1. Unit Tests (Services Layer)

Test individual service methods in isolation with mocked DB.

**EntanglementService** (`src/services/entanglements.ts`)
| Method | Test Cases |
|--------|------------|
| `list()` | Empty list, with filters (root_only, parent_id), pagination (limit/offset) |
| `get()` | Found, not found (404), with/without children qupts |
| `create()` | Valid input, missing required fields, invalid parent_id, with initial_zoku |
| `update()` | Valid update, not found, circular parent reference |
| `delete()` | Success with confirm=true, fail without confirm, not found |
| `move()` | Valid move, circular reference prevention |
| `getMatrix()` | Returns PASCI roles, not found |
| `assignToMatrix()` | Valid assignment, duplicate accountable warning |
| `removeFromMatrix()` | Success, last accountable protection |
| `getAttributes()` | Returns formatted attributes |
| `listSources()` | Returns sources for entanglement |

**ZokuService** (`src/services/zoku.ts`)
| Method | Test Cases |
|--------|------------|
| `list()` | Empty list, type filter, pagination |
| `get()` | Found with entanglements, not found |
| `create()` | Valid human/agent, tier enforcement (created as 'observed') |
| `update()` | Valid update, not found |
| `delete()` | Success, not found |
| `updateTier()` | Prime-only enforcement, valid tier change, audit logging |

**QuptService** (`src/services/qupts.ts`)
| Method | Test Cases |
|--------|------------|
| `list()` | Filters (entanglement_id, source, since/until), recursive aggregation |
| `get()` | Found, not found |
| `create()` | Valid qupt, invalid entanglement_id, invalid zoku_id |
| `batchCreate()` | Multiple qupts, deduplication |
| `delete()` | Success, not found |

**JewelService** (`src/services/jewels.ts`)
| Method | Test Cases |
|--------|------------|
| `list()` | Ownership filtering (user sees own, prime sees all), type filter |
| `get()` | Found, not found, ownership check |
| `create()` | Valid jewel with validation, validation failure, encryption |
| `update()` | Re-validation on data change |
| `delete()` | Success, ownership check, in-use protection |
| `getUsage()` | Returns sources using jewel |

**SourceService** (`src/services/sources.ts`)
| Method | Test Cases |
|--------|------------|
| `get()` | Found (credentials stripped), not found |
| `create()` | Valid with jewel_id, valid with inline jewels, invalid jewel_id |
| `update()` | Config update, enable/disable |
| `delete()` | Success, cascade delete with qupts |
| `sync()` | Success, disabled source error, sync error handling |

### 2. Authorization Tests

Test tier-based access control at service layer.

```typescript
describe('Authorization', () => {
  describe('tier requirements', () => {
    it('observed user cannot access anything', async () => {
      // Expect ForbiddenError
    });
    
    it('coherent user can read but not write', async () => {
      // Can: list/get entanglements, zoku, qupts
      // Can: manage own jewels
      // Cannot: create/update/delete entanglements, zoku
    });
    
    it('entangled user has full CRUD', async () => {
      // Can do everything except tier management
    });
    
    it('prime user can manage tiers', async () => {
      // Can promote/demote users
    });
  });
});
```

### 3. API Integration Tests

Test full HTTP request/response cycle through Hono routes.

**Entanglements API** (`/api/entanglements`)
```typescript
describe('GET /api/entanglements', () => {
  it('returns list with counts', async () => {});
  it('filters by root_only', async () => {});
  it('paginates correctly', async () => {});
  it('returns 401 without auth', async () => {});
});

describe('POST /api/entanglements', () => {
  it('creates entanglement', async () => {});
  it('creates with initial PASCI assignments', async () => {});
  it('returns 400 for invalid body', async () => {});
  it('returns 403 for coherent user', async () => {});
});

describe('GET /api/entanglements/:id', () => {
  it('returns full details with matrix, children, qupts', async () => {});
  it('returns 404 for unknown id', async () => {});
});

describe('PATCH /api/entanglements/:id', () => {
  it('updates name and description', async () => {});
  it('prevents circular parent reference', async () => {});
});

describe('DELETE /api/entanglements/:id', () => {
  it('requires confirm=true', async () => {});
  it('cascades to children', async () => {});
});
```

**PASCI Matrix API**
```typescript
describe('POST /api/entanglements/:id/matrix', () => {
  it('assigns zoku to role', async () => {});
  it('warns on multiple accountable', async () => {});
});

describe('DELETE /api/entanglements/:id/matrix/:zoku_id/:role', () => {
  it('removes assignment', async () => {});
  it('prevents removing last accountable', async () => {});
});
```

**Zoku API** (`/api/zoku`)
```typescript
describe('GET /api/zoku', () => {});
describe('POST /api/zoku', () => {});
describe('GET /api/zoku/:id', () => {});
describe('PATCH /api/zoku/:id', () => {});
describe('DELETE /api/zoku/:id', () => {});
```

**Qupts API** (`/api/qupts`)
```typescript
describe('GET /api/qupts', () => {
  it('filters by entanglement_id', async () => {});
  it('filters by source type', async () => {});
  it('supports recursive aggregation', async () => {});
});

describe('POST /api/qupts', () => {});
describe('POST /api/qupts/batch', () => {
  it('deduplicates by external_id', async () => {});
});
```

**Sources API** (`/api/sources`)
```typescript
describe('POST /api/entanglements/:id/sources', () => {
  it('creates with jewel_id reference', async () => {});
  it('validates jewel ownership', async () => {});
});

describe('POST /api/sources/:id/sync', () => {
  it('triggers manual sync', async () => {});
  it('returns error for disabled source', async () => {});
});
```

**Jewels API** (`/api/jewels`)
```typescript
describe('POST /api/jewels', () => {
  it('validates GitHub token', async () => {});
  it('validates Zammad credentials', async () => {});
  it('encrypts data at rest', async () => {});
});

describe('DELETE /api/jewels/:id', () => {
  it('blocks deletion if in use', async () => {});
});
```

### 4. MCP Integration Tests

Test MCP protocol compliance and tool execution.

```typescript
describe('MCP Server', () => {
  describe('authentication', () => {
    it('accepts valid Bearer token', async () => {});
    it('rejects missing token', async () => {});
    it('rejects invalid token', async () => {});
    it('respects user tier from token', async () => {});
  });

  describe('tools/list', () => {
    it('returns all 29 tools', async () => {});
    it('includes proper schema definitions', async () => {});
  });

  describe('tools/call', () => {
    // Test each tool with valid/invalid inputs
    describe('list_entanglements', () => {
      it('returns entanglements', async () => {});
      it('respects detailed parameter', async () => {});
    });
    
    describe('create_entanglement', () => {
      it('creates with initial_zoku', async () => {});
    });
    
    // ... all 29 tools
  });
});
```

### 5. OAuth 2.1 Flow Tests

Test complete OAuth authorization flow.

```typescript
describe('OAuth 2.1', () => {
  describe('/.well-known/oauth-authorization-server', () => {
    it('returns correct metadata', async () => {});
  });

  describe('GET /oauth/authorize', () => {
    it('renders authorization page for authenticated user', async () => {});
    it('returns 403 for observed tier', async () => {});
    it('validates PKCE code_challenge_method is S256', async () => {});
    it('validates redirect_uri is HTTPS or localhost', async () => {});
  });

  describe('POST /oauth/authorize', () => {
    it('generates authorization code on approval', async () => {});
    it('redirects with error on denial', async () => {});
  });

  describe('POST /oauth/token', () => {
    describe('authorization_code grant', () => {
      it('exchanges code for tokens', async () => {});
      it('validates code_verifier (PKCE)', async () => {});
      it('rejects expired code', async () => {});
    });
    
    describe('refresh_token grant', () => {
      it('issues new access token', async () => {});
      it('rejects revoked refresh token', async () => {});
    });
  });

  describe('POST /oauth/register', () => {
    it('registers new client dynamically', async () => {});
  });

  describe('POST /oauth/revoke', () => {
    it('revokes access token', async () => {});
    it('revokes refresh token', async () => {});
  });
});
```

### 6. Source Handler Tests

Test external API integrations (with mocked HTTP).

```typescript
describe('GitHub Handler', () => {
  it('fetches events from GitHub API', async () => {});
  it('maps event types correctly', async () => {});
  it('enriches push events with commit messages', async () => {});
  it('enriches PR events with details', async () => {});
  it('handles API errors gracefully', async () => {});
  it('respects since parameter for incremental sync', async () => {});
});

describe('Zammad Handler', () => {
  it('fetches tickets by tag', async () => {});
  it('includes articles when configured', async () => {});
  it('handles pagination', async () => {});
});

describe('Google Drive Handler', () => {
  it('fetches document revisions', async () => {});
  it('handles OAuth token refresh', async () => {});
  it('handles access denied errors', async () => {});
});

describe('Gmail Handler', () => {
  it('fetches emails matching query', async () => {});
  it('filters by labels', async () => {});
});
```

### 7. Scheduled Task Tests

Test cron-triggered source synchronization.

```typescript
describe('Scheduled Sync', () => {
  it('processes all enabled sources', async () => {});
  it('skips disabled sources', async () => {});
  it('handles partial failures gracefully', async () => {});
  it('updates last_sync on success', async () => {});
  it('increments error_count on failure', async () => {});
  it('clears error state on success', async () => {});
  it('logs summary with success/failure counts', async () => {});
});
```

### 8. Database Integration Tests

Test complex queries and data integrity.

```typescript
describe('Database', () => {
  describe('entanglement hierarchy', () => {
    it('cascades delete to children', async () => {});
    it('recursive CTE finds all descendants', async () => {});
    it('counts include nested children', async () => {});
  });

  describe('qupt deduplication', () => {
    it('unique index prevents duplicate external_id', async () => {});
    it('INSERT OR IGNORE skips duplicates in batch', async () => {});
  });

  describe('PASCI matrix', () => {
    it('enforces valid roles', async () => {});
    it('allows multiple entities per role except accountable', async () => {});
  });

  describe('jewel encryption', () => {
    it('data is encrypted at rest', async () => {});
    it('decrypts correctly with key', async () => {});
  });

  describe('audit logging', () => {
    it('logs tier changes', async () => {});
    it('logs jewel operations', async () => {});
    it('includes request context', async () => {});
  });
});
```

### 9. Error Handling Tests

Test error sanitization and responses.

```typescript
describe('Error Handling', () => {
  it('sanitizes database errors', async () => {});
  it('formats Zod validation errors', async () => {});
  it('returns proper HTTP status codes', async () => {});
  it('does not leak stack traces', async () => {});
  it('logs full error server-side', async () => {});
});
```

### 10. Security Tests

```typescript
describe('Security', () => {
  describe('authentication', () => {
    it('rejects requests without CF Access JWT', async () => {});
    it('validates JWT signature in production', async () => {});
    it('decodes JWT without validation in dev mode', async () => {});
  });

  describe('authorization', () => {
    it('enforces tier-based access', async () => {});
    it('ownership checks on jewels', async () => {});
  });

  describe('headers', () => {
    it('sets security headers on all responses', async () => {});
    it('uses relaxed headers for OAuth endpoints', async () => {});
  });

  describe('CSRF', () => {
    it('OAuth state parameter prevents CSRF', async () => {});
  });
});
```

## Test File Structure

```
tests/
├── setup.ts                    # Global test setup, mocks, helpers
├── fixtures/
│   ├── users.ts               # Test user data (observed, coherent, entangled, prime)
│   ├── entanglements.ts       # Sample entanglement hierarchies
│   └── github-events.ts       # Mocked GitHub API responses
├── unit/
│   ├── services/
│   │   ├── entanglements.test.ts
│   │   ├── zoku.test.ts
│   │   ├── qupts.test.ts
│   │   ├── jewels.test.ts
│   │   └── sources.test.ts
│   ├── handlers/
│   │   ├── github.test.ts
│   │   ├── zammad.test.ts
│   │   ├── gdrive.test.ts
│   │   └── gmail.test.ts
│   └── lib/
│       ├── validation.test.ts
│       ├── errors.test.ts
│       └── crypto.test.ts
├── integration/
│   ├── api/
│   │   ├── entanglements.test.ts
│   │   ├── zoku.test.ts
│   │   ├── qupts.test.ts
│   │   ├── sources.test.ts
│   │   └── jewels.test.ts
│   ├── mcp/
│   │   ├── auth.test.ts
│   │   └── tools.test.ts
│   ├── oauth/
│   │   ├── discovery.test.ts
│   │   ├── authorization.test.ts
│   │   └── token.test.ts
│   └── scheduled.test.ts
└── e2e/
    ├── flows/
    │   ├── user-onboarding.test.ts
    │   ├── project-lifecycle.test.ts
    │   └── source-sync.test.ts
    └── mcp-client.test.ts
```

## Test Configuration

### vitest.config.ts
```typescript
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    globals: true,
    environment: 'miniflare',
    environmentOptions: {
      modules: true,
      bindings: {
        ENCRYPTION_KEY: 'test-encryption-key-32-bytes!!!',
        JWT_SECRET: 'test-jwt-secret'
      },
      d1Databases: ['DB'],
      kvNamespaces: ['AUTH_KV']
    },
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/types.ts', 'src/**/*.d.ts']
    }
  }
});
```

### package.json additions
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.5.0",
    "vitest": "^2.1.0",
    "@vitest/coverage-v8": "^2.1.0",
    "@vitest/ui": "^2.1.0"
  }
}
```

## Test Helpers

### tests/setup.ts
```typescript
import { SELF } from 'cloudflare:test';
import { beforeAll, afterEach, vi } from 'vitest';

// Global fetch mock for external APIs
vi.mock('node-fetch');

// Reset database between tests
beforeAll(async () => {
  // Run migrations
  const db = SELF.DB;
  const schema = await Bun.file('./schema.sql').text();
  await db.exec(schema);
  
  // Run seed
  const seed = await Bun.file('./seed.sql').text();
  await db.exec(seed);
});

afterEach(async () => {
  // Clean up test data
  const db = SELF.DB;
  await db.exec('DELETE FROM qupts');
  await db.exec('DELETE FROM sources');
  await db.exec('DELETE FROM entanglement_zoku');
  await db.exec('DELETE FROM entanglement_attributes');
  await db.exec('DELETE FROM jewels');
  await db.exec('DELETE FROM entanglements');
  await db.exec('DELETE FROM zoku WHERE email NOT LIKE \'%@test.local\'');
});

// Helper to create authenticated requests
export function createAuthenticatedRequest(
  method: string,
  path: string,
  options: {
    user?: { email: string; tier: string };
    body?: any;
  } = {}
) {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  
  if (options.user) {
    // Create dev JWT
    const payload = {
      email: options.user.email,
      sub: `test-${options.user.email}`,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };
    const jwt = createDevJWT(payload);
    headers.set('cf-access-jwt-assertion', jwt);
  }
  
  return new Request(`http://localhost${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
}

function createDevJWT(payload: object): string {
  const header = { alg: 'none', typ: 'JWT' };
  const enc = (obj: object) => btoa(JSON.stringify(obj));
  return `${enc(header)}.${enc(payload)}.`;
}
```

## Priority Order for Implementation

### Phase 1: Foundation (Week 1)
1. Set up Vitest with Cloudflare Workers pool
2. Create test fixtures and helpers
3. Unit tests for validation schemas
4. Unit tests for error handling

### Phase 2: Service Layer (Week 2)
1. EntanglementService tests (highest complexity)
2. ZokuService tests
3. QuptService tests
4. JewelService tests
5. SourceService tests

### Phase 3: API Integration (Week 3)
1. Authentication middleware tests
2. Entanglements API tests
3. Zoku API tests
4. Qupts API tests
5. Sources and Jewels API tests

### Phase 4: MCP & OAuth (Week 4)
1. MCP authentication tests
2. MCP tool tests (all 29 tools)
3. OAuth discovery and metadata
4. OAuth authorization flow
5. OAuth token exchange

### Phase 5: External Integrations (Week 5)
1. GitHub handler tests (with mocked API)
2. Zammad handler tests
3. Google Drive/Gmail handler tests
4. Scheduled sync tests

### Phase 6: E2E & Polish (Week 6)
1. End-to-end user flows
2. Security tests
3. Performance tests
4. Coverage analysis and gap filling

## Coverage Goals

| Category | Target Coverage |
|----------|-----------------|
| Services | 90%+ |
| API Routes | 85%+ |
| MCP Tools | 85%+ |
| OAuth | 90%+ |
| Handlers | 80%+ |
| Error Handling | 95%+ |
| **Overall** | **85%+** |

## CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json
```

## Notes

1. **D1 Mocking**: Use `@cloudflare/vitest-pool-workers` for realistic D1 testing
2. **External APIs**: Always mock external HTTP calls (GitHub, Zammad, Google)
3. **Encryption**: Test with consistent test key, verify encryption/decryption roundtrip
4. **OAuth State**: Test PKCE flow completely, including code_verifier validation
5. **Tier Enforcement**: Create test users at each tier level for authorization tests
