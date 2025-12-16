# Deployment Checklist

**Status**: ✅ Ready for Production
**Last Verified**: 2025-12-16

## Pre-Deployment Verification

### Repository Scan Results

| Component | Status | Notes |
|-----------|--------|-------|
| **Frontend Build** | ✅ Ready | `frontend/dist` exists, builds successfully |
| **Wrangler Config** | ⚠️ Needs Update | KV namespace has placeholder IDs |
| **Database Schema** | ✅ Ready | `schema.sql` complete with all tables |
| **Seed Data** | ✅ Ready | `seed.sql` with taxonomy dimensions |
| **Environment Secrets** | ⚠️ Not Set | ENCRYPTION_KEY, JWT_SECRET, ADMIN_EMAIL required |
| **Dependencies** | ✅ Ready | All packages installed, no missing deps |
| **Authentication** | ✅ Ready | Full OAuth 2.1 + PAT implementation |
| **Service Layer** | ✅ Ready | Complete refactor, no blocking issues |
| **Source Handlers** | ✅ Ready | GitHub, Zammad, Gmail, Google Drive working |
| **Cron Jobs** | ✅ Ready | `*/5 * * * *` configured in wrangler.toml |

## Deployment Blockers & Solutions

### 🔴 Critical (Must Fix Before Deploy)

#### 1. KV Namespace IDs

**Blocker**: `wrangler.toml` has placeholder KV IDs:
```toml
[[kv_namespaces]]
binding = "AUTH_KV"
id = "placeholder-for-production"
preview_id = "placeholder-for-preview"
```

**Solution**:
```bash
# Create production KV namespace
npx wrangler kv namespace create AUTH_KV

# Create preview KV namespace (for wrangler dev)
npx wrangler kv namespace create AUTH_KV --preview

# Update wrangler.toml with real IDs
```

**Script**: Automated in `deploy.sh` step 1

---

#### 2. Missing Production Secrets

**Blocker**: Three required secrets not set in production:
- `ENCRYPTION_KEY` - For jewels and OAuth app credentials
- `JWT_SECRET` - For MCP OAuth and PAT tokens
- `ADMIN_EMAIL` - For first admin user auto-promotion

**Solution**:
```bash
# Generate 32-byte keys
openssl rand -base64 32  # Copy output
npx wrangler secret put ENCRYPTION_KEY

openssl rand -base64 32  # Copy output
npx wrangler secret put JWT_SECRET

npx wrangler secret put ADMIN_EMAIL
# Enter: your-email@example.com
```

**Script**: Automated in `deploy.sh` step 2

---

#### 3. Uninitialized Database

**Blocker**: Remote D1 database exists but has no tables.

**Solution**:
```bash
# Create all tables
npx wrangler d1 execute the-great-game --remote --file=./schema.sql

# Load taxonomy seed data
npx wrangler d1 execute the-great-game --remote --file=./seed.sql
```

**Script**: Automated in `deploy.sh` step 3

---

### 🟡 Recommended (Should Configure)

#### 4. Cloudflare Access Not Configured

**Blocker**: Web UI requires authentication via Cloudflare Access.

**Solution**:
```bash
# Open dashboard
npx wrangler open

# Navigate to: Zero Trust → Access → Applications
# Add application:
#   - Type: Self-hosted
#   - Domain: zoku.205.dev
#   - Policy: Allow emails @reset.tech
```

**Alternative**: Use dev JWT for testing (not secure for production)

---

#### 5. Custom Domain Not Configured

**Blocker**: Worker deploys to `*.workers.dev` subdomain.

**Solution**:
```bash
# Add custom domain
npx wrangler domains add zoku.205.dev
```

**Alternative**: Add to wrangler.toml:
```toml
routes = [{ pattern = "zoku.205.dev/*", zone_name = "205.dev" }]
```

---

## Deployment Methods

### Option 1: Automated Script (Recommended)

```bash
chmod +x deploy.sh
./deploy.sh
```

**Handles**:
- KV namespace creation
- Secret generation and setting
- Database initialization
- Frontend build
- Worker deployment
- Verification and testing

**Time**: ~5 minutes (interactive)

---

### Option 2: Manual Steps

See [README.md](./README.md) section "Manual Step-by-Step Deployment"

**Time**: ~10 minutes

---

## Post-Deployment Verification

### 1. Health Check
```bash
curl https://zoku.205.dev/health
# Expected: {"status":"ok","timestamp":"..."}
```

### 2. OAuth Metadata
```bash
curl https://zoku.205.dev/.well-known/oauth-authorization-server
# Expected: OAuth 2.1 server metadata JSON
```

### 3. Database Tables
```bash
npx wrangler d1 execute the-great-game --remote \
  --command "SELECT COUNT(*) as table_count FROM sqlite_master WHERE type='table'"
# Expected: 12-15 tables
```

### 4. Secrets Set
```bash
npx wrangler secret list
# Expected: ENCRYPTION_KEY, JWT_SECRET, ADMIN_EMAIL
```

### 5. Cron Active
```bash
npx wrangler tail --format pretty | grep scheduled
# Wait 5 minutes, should see scheduled handler logs
```

### 6. Admin User
```bash
# Login via web UI at https://zoku.205.dev
# Check tier:
npx wrangler d1 execute the-great-game --remote \
  --command "SELECT email, access_tier FROM zoku WHERE type='human'"
# Expected: ADMIN_EMAIL with access_tier='prime'
```

---

## Rollback Plan

```bash
# View deployments
npx wrangler deployments list

# Rollback to previous version (if needed)
npx wrangler rollback <version-id>
```

---

## Monitoring

### Live Logs
```bash
npx wrangler tail --format pretty
```

### Filter Errors
```bash
npx wrangler tail --format pretty | grep '"level":"error"'
```

### Track Specific Request
```bash
npx wrangler tail --format pretty | grep '"request_id":"abc12345"'
```

---

## Common Issues

### "No such table" Error
```bash
# Re-run migrations
npx wrangler d1 execute the-great-game --remote --file=./schema.sql
```

### "ENCRYPTION_KEY not configured"
```bash
# Set the secret
openssl rand -base64 32 | npx wrangler secret put ENCRYPTION_KEY
```

### "Invalid authentication token"
- Verify Cloudflare Access is configured
- Check ADMIN_EMAIL matches login email
- Ensure `Cf-Access-Jwt-Assertion` header exists

### MCP OAuth Not Working
```bash
# Verify JWT_SECRET is set
npx wrangler secret list

# Check KV namespace is bound
grep -A2 "kv_namespaces" wrangler.toml

# Test metadata endpoint
curl https://zoku.205.dev/.well-known/oauth-authorization-server
```

---

## Security Checklist

- [ ] ENCRYPTION_KEY is 32+ bytes, randomly generated
- [ ] JWT_SECRET is 32+ bytes, randomly generated
- [ ] Secrets never committed to git (use `wrangler secret put`)
- [ ] Cloudflare Access configured (not using dev JWTs in prod)
- [ ] ADMIN_EMAIL set to actual admin email
- [ ] Custom domain configured (not using *.workers.dev)
- [ ] HTTPS enforced (automatic with CF Workers)
- [ ] Rate limiting considered (future enhancement)

---

## Performance

### Expected Metrics
- **Cold Start**: ~100-200ms
- **Warm Response**: ~20-50ms
- **Database Query**: ~5-10ms (D1 SQLite)
- **MCP Tool Call**: ~50-200ms (depends on tool)
- **Source Sync**: ~1-5s per source (GitHub, Zammad, Google Drive)

### Limits
- **D1 Database**: 500MB storage, 25M reads/day, 50M writes/day
- **KV Storage**: 1GB, 100K reads/day, 1K writes/day
- **Worker CPU**: 50ms per request (streaming extends to 30s)
- **Worker Memory**: 128MB per request
- **Cron**: Every 5 minutes (288 runs/day)

---

## Support

**Documentation**: [README.md](./README.md)
**Authentication**: [docs/authentication.md](./docs/authentication.md)
**Issues**: Check logs with `npx wrangler tail --format pretty`
