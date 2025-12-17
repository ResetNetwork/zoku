# CSRF Protection Analysis
**Date**: 2025-12-17  
**Current Status**: ⚠️ No CSRF tokens (mitigated by architecture)  
**Risk Level**: Low

---

## Executive Summary

The application currently has **no explicit CSRF protection** but is **inherently resistant to CSRF attacks** due to its stateless JWT architecture. Adding CSRF tokens would provide defense-in-depth but is **low priority**.

### Current Protection: Architecture-Based

**Authentication Method**: Stateless JWT (Cloudflare Access)
- No session cookies
- All auth via `Cf-Access-Jwt-Assertion` header
- JavaScript-injected on every request

**Why This Resists CSRF**:
```
Traditional CSRF Attack (fails here):
1. Attacker creates malicious site: evil.com
2. User visits while logged into zoku (has cookies)
3. evil.com sends: <form action="https://tgg.yourdomain.com/api/entanglements" method="POST">
4. Browser AUTO-SENDS cookies with cross-origin request
5. ❌ FAILS: No cookies = no auth = request rejected
```

**Current Flow**:
```
Legitimate Request:
1. User loads app from tgg.yourdomain.com
2. JavaScript gets JWT from Cloudflare Access
3. Fetch API sends: Cf-Access-Jwt-Assertion: <jwt>
4. Request succeeds

CSRF Attack Attempt:
1. evil.com tries to forge request
2. ❌ Cannot access Cloudflare Access JWT (same-origin policy)
3. ❌ Cannot read JWT from victim's page
4. ❌ Cannot set Cf-Access-Jwt-Assertion header from evil.com
5. Request fails (401 Unauthorized)
```

---

## CSRF Vulnerability Assessment

### State-Changing Operations (POST/DELETE/PATCH)

| Endpoint | Method | Auth | CSRF Risk | Notes |
|----------|--------|------|-----------|-------|
| `/api/entanglements` | POST | JWT Header | **Low** | No cookies |
| `/api/entanglements/:id` | PATCH | JWT Header | **Low** | No cookies |
| `/api/entanglements/:id` | DELETE | JWT Header | **Low** | No cookies |
| `/api/zoku` | POST | JWT Header | **Low** | No cookies |
| `/api/qupts` | POST | JWT Header | **Low** | No cookies |
| `/api/sources` | POST | JWT Header | **Low** | No cookies |
| `/api/jewels` | POST | JWT Header | **Low** | No cookies |
| `/oauth/authorize` | POST | JWT Header | **Low** | OAuth has state param |
| `/oauth/sessions/:id` | DELETE | JWT Header | **Low** | No cookies |

**All endpoints require JWT in header** → Cannot be forged from evil.com

### What Would Make CSRF Possible

**If we added session cookies** (we don't):
```typescript
// DON'T DO THIS (makes CSRF possible):
c.cookie('session_id', sessionId, {
  httpOnly: true,
  secure: true,
  // Missing: sameSite: 'strict'  ← without this, CSRF works
});
```

**Attack scenario if cookies existed**:
```html
<!-- evil.com -->
<form action="https://tgg.yourdomain.com/api/entanglements" method="POST">
  <input type="hidden" name="name" value="Evil Entanglement">
  <input type="submit" value="Click for Free Prize!">
</form>
```

Browser would send cookies automatically → Request succeeds → User tricked

---

## Implementation Options

### Option 1: No Action (Recommended)

**Reasoning**:
- ✅ No cookies = no CSRF via cookie auto-attach
- ✅ JWT in header cannot be accessed cross-origin
- ✅ OAuth has state parameter (built-in CSRF for OAuth)
- ✅ Same-origin policy prevents JWT theft
- ✅ No complexity overhead

**Risk**: Low - architecture provides strong defense

**Recommendation**: ✅ **Accept current posture**, document why CSRF tokens not needed

---

### Option 2: SameSite Cookies (if we add cookies)

**If cookies were added**, use SameSite attribute:

```typescript
// Secure cookie configuration
c.cookie('session_id', sessionId, {
  httpOnly: true,       // Prevent JavaScript access
  secure: true,         // HTTPS only
  sameSite: 'strict',   // ← CSRF protection
  maxAge: 86400         // 24 hours
});
```

**SameSite modes**:
- `strict`: Never sent on cross-origin requests (best CSRF protection)
- `lax`: Sent on top-level navigation (GET only)
- `none`: Always sent (requires explicit CSRF tokens)

**Pros**:
- ✅ Simple (one attribute)
- ✅ Browser-enforced
- ✅ No JavaScript changes needed

**Cons**:
- ❌ Not needed (we don't use cookies)
- ❌ Browser compatibility (though 95%+ support now)

---

### Option 3: Explicit CSRF Tokens

**Full implementation with CSRF tokens**:

#### Backend: Token Generation

```typescript
// src/lib/csrf.ts
import { Context } from 'hono';

const CSRF_TOKEN_TTL = 3600; // 1 hour

/**
 * Generate CSRF token for current user session
 */
export async function generateCsrfToken(
  env: Bindings,
  userId: string
): Promise<string> {
  const token = crypto.randomUUID();
  const key = `csrf:${token}`;
  
  await env.AUTH_KV.put(key, userId, { expirationTtl: CSRF_TOKEN_TTL });
  
  return token;
}

/**
 * Validate CSRF token belongs to user (one-time use)
 */
export async function validateCsrfToken(
  env: Bindings,
  token: string,
  userId: string
): Promise<boolean> {
  const key = `csrf:${token}`;
  const storedUserId = await env.AUTH_KV.get(key);
  
  if (storedUserId !== userId) {
    return false;
  }
  
  // Delete after use (one-time token)
  await env.AUTH_KV.delete(key);
  
  return true;
}
```

#### Backend: Middleware

```typescript
// src/middleware/csrf.ts
import { Context, Next } from 'hono';
import { validateCsrfToken } from '../lib/csrf';

/**
 * CSRF protection middleware
 * Validates X-CSRF-Token header on state-changing operations
 */
export function csrfMiddleware() {
  return async (c: Context, next: Next) => {
    const method = c.req.method;
    
    // Only check state-changing operations
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      await next();
      return;
    }
    
    const token = c.req.header('X-CSRF-Token');
    const user = c.get('user');
    
    if (!token) {
      return c.json({ error: 'CSRF token required' }, 403);
    }
    
    const valid = await validateCsrfToken(c.env, token, user.id);
    
    if (!valid) {
      return c.json({ error: 'Invalid CSRF token' }, 403);
    }
    
    await next();
  };
}
```

#### Backend: Token Endpoint

```typescript
// src/api/csrf.ts
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { generateCsrfToken } from '../lib/csrf';

const app = new Hono();

// Get CSRF token
app.get('/token', authMiddleware(), async (c) => {
  const user = c.get('user');
  const token = await generateCsrfToken(c.env, user.id);
  
  return c.json({ csrf_token: token });
});

export default app;
```

#### Frontend: Token Management

```typescript
// frontend/src/lib/csrf.ts

/**
 * Fetch fresh CSRF token
 */
async function getCsrfToken(): Promise<string> {
  const response = await fetch('/api/csrf/token');
  const data = await response.json();
  return data.csrf_token;
}

/**
 * Cached token with auto-refresh
 */
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

export async function ensureCsrfToken(): Promise<string> {
  const now = Date.now();
  
  // Return cached if still valid (within 50 minutes)
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }
  
  // Fetch new token
  cachedToken = await getCsrfToken();
  tokenExpiry = now + (50 * 60 * 1000); // 50 min (token is 60 min)
  
  return cachedToken;
}
```

#### Frontend: API Client Update

```typescript
// frontend/src/lib/api.ts (modified)
import { ensureCsrfToken } from './csrf';

async function apiCall(path: string, options: RequestInit = {}) {
  // Add CSRF token to state-changing requests
  if (options.method && options.method !== 'GET') {
    const token = await ensureCsrfToken();
    options.headers = {
      ...options.headers,
      'X-CSRF-Token': token
    };
  }
  
  const response = await fetch(`/api${path}`, options);
  return response.json();
}
```

#### Mount in Application

```typescript
// src/index.ts (add CSRF protection)
import csrfRoutes from './api/csrf';
import { csrfMiddleware } from './middleware/csrf';

// CSRF token endpoint (no CSRF check, returns token)
app.route('/api/csrf', csrfRoutes);

// Add CSRF middleware to protected routes
app.use('/api/*', authMiddleware());
app.use('/api/*', csrfMiddleware());  // ← After auth
```

**Pros**:
- ✅ Defense-in-depth
- ✅ Standard security practice
- ✅ Explicit protection

**Cons**:
- ❌ Adds complexity (backend + frontend)
- ❌ Extra API call per session
- ❌ KV storage overhead
- ❌ Not needed given current architecture

**Effort**: ~4-6 hours implementation + testing

---

## Recommendation

### ✅ Option 1: No Action (Document Why)

**Rationale**:
1. **Architecture provides strong defense**: No cookies = no CSRF via auto-attach
2. **JWT in header**: Cannot be accessed or sent cross-origin
3. **OAuth has state**: Built-in CSRF protection for OAuth flow
4. **Low ROI**: Adding tokens provides minimal security benefit
5. **Complexity cost**: Implementation + maintenance overhead

**What to do**:
- ✅ Document current CSRF posture
- ✅ Add comment in auth middleware explaining why no CSRF needed
- ✅ Monitor for architecture changes (if cookies added, revisit)

### If Cookies Are Added in Future

**Then implement**: Option 2 (SameSite cookies) + Option 3 (CSRF tokens)

**Code location for future reference**:
```typescript
// src/middleware/auth.ts
// NOTE: CSRF protection not needed because:
// 1. No session cookies (stateless JWT in headers)
// 2. JWT cannot be accessed cross-origin (same-origin policy)
// 3. OAuth state parameter provides CSRF protection for OAuth flow
// If cookies are added in future, implement CSRF tokens per docs/CSRF_PROTECTION_ANALYSIS.md
```

---

## Security Checklist

**Current State**:
- ✅ No session cookies
- ✅ JWT in custom header (not cookie)
- ✅ OAuth state parameter
- ✅ Same-origin policy enforced
- ✅ Cloudflare Access (enterprise SSO)

**If Adding Session Features**:
- [ ] Implement SameSite cookies
- [ ] Add CSRF token generation
- [ ] Add CSRF validation middleware
- [ ] Update frontend to send tokens
- [ ] Test cross-origin forgery attempts

---

## Testing CSRF Resistance

### Manual Test (Current Architecture)

```bash
# 1. Create malicious HTML page
cat > /tmp/csrf-test.html << 'EOF'
<!DOCTYPE html>
<html>
<body>
  <h1>CSRF Test</h1>
  <button onclick="attack()">Attempt CSRF</button>
  <div id="result"></div>
  
  <script>
    async function attack() {
      try {
        const response = await fetch('https://tgg.yourdomain.com/api/entanglements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Evil Entanglement' })
        });
        document.getElementById('result').textContent = 'Success: ' + response.status;
      } catch (error) {
        document.getElementById('result').textContent = 'Failed: ' + error.message;
      }
    }
  </script>
</body>
</html>
EOF

# 2. Serve on different origin
python3 -m http.server 8000 -d /tmp

# 3. Open http://localhost:8000/csrf-test.html
# 4. Click button
# 5. Expected: 401 Unauthorized (no JWT header can be sent)
```

**Result**: Attack fails because:
- Browser doesn't send `Cf-Access-Jwt-Assertion` header cross-origin
- No cookies to auto-attach
- CORS may block response (but request still fails on auth)

---

## References

- **OWASP CSRF**: https://owasp.org/www-community/attacks/csrf
- **SameSite Cookies**: https://web.dev/samesite-cookies-explained/
- **JWT & CSRF**: https://stackoverflow.com/questions/21357182/csrf-token-necessary-when-using-stateless-sessionless-authentication

---

## Conclusion

**Current State**: ✅ **Architecturally resistant to CSRF**

**Action Required**: Document reasoning (this file serves that purpose)

**Future Trigger**: If session cookies added → Implement Options 2 & 3

**Security Posture**: Strong (stateless JWT > cookie-based sessions for CSRF)
