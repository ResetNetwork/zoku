# Documentation Cleanup Plan
**Date**: 2025-12-16  
**Status**: Ready to Execute

## Summary

We have **14 documentation files (~8,000 lines)** with significant redundancy. This plan consolidates to **6 essential files** by removing 7 redundant documents and updating 2 outdated ones.

---

## Action Plan

### 1. Files to REMOVE (7 files, 3,416 lines)

These files are either redundant (content merged into other docs) or outdated:

```bash
rm docs/authentication-review-2025-12-16.md          # 950 lines - redundant with authentication.md
rm docs/authentication-implementation-progress.md    # 266 lines - implementation complete
rm docs/global-authentication-strategy.md            # 650 lines - strategy implemented
rm docs/global-auth-implementation-summary.md        # 250 lines - summary redundant
rm docs/ux-improvements-2025-12-16.md                # 400 lines - improvements complete
rm docs/deep-analysis-2025-12-11-updated.md          # 700 lines - superseded by new analysis
rm docs/refactoring-plan-great-game.md               # 200 lines - outdated (pre-auth)
```

**Rationale**:
- `authentication-review-2025-12-16.md` → Content covered in `authentication.md`
- `authentication-implementation-progress.md` → Implementation complete, no longer needed
- `global-authentication-strategy.md` → Strategy implemented, documented in `authentication.md`
- `global-auth-implementation-summary.md` → Summary redundant with main docs
- `ux-improvements-2025-12-16.md` → All improvements implemented and documented
- `deep-analysis-2025-12-11-updated.md` → Superseded by `COMPREHENSIVE_ANALYSIS_2025-12-16.md`
- `refactoring-plan-great-game.md` → Outdated (pre-authentication work)

### 2. Files to KEEP (6 files, 2,349 lines)

These files remain essential:

- ✅ `CLAUDE.md` (800 lines) - Master context document
- ✅ `README.md` (150 lines) - Project overview
- ✅ `docs/authentication.md` (519 lines) - Complete auth documentation
- ✅ `docs/cloudflare-access-bypass-config.md` (400 lines) - CF Access setup guide
- ✅ `docs/admin-pages-security-review.md` (500 lines) - Security audit
- ✅ `docs/audit-logging-events.md` (180 lines) - Event reference
- ✅ `docs/COMPREHENSIVE_ANALYSIS_2025-12-16.md` (NEW) - This comprehensive analysis
- ✅ `docs/DOCUMENTATION_CLEANUP_PLAN.md` (NEW) - This cleanup plan

### 3. Files to UPDATE (2 files)

**A. `docs/zoku-spec.md`** (350 lines)
- **Issue**: Missing Phase 5.7 (Authentication), Phase 6 status
- **Update**:
  - Add Phase 5.7 section (Authentication System)
  - Update Phase 6 status (ready for deployment)
  - Add authentication overview to architecture section

**B. `docs/DEPLOYMENT_READY.md`** (400 lines)
- **Issue**: Incomplete, missing runbook details
- **Update**:
  - Add detailed deployment checklist
  - Add rollback procedure
  - Add troubleshooting section
  - Add monitoring setup guide

### 4. File to CREATE

**`docs/PRODUCTION_RUNBOOK.md`** (NEW)

Critical production operations guide covering:
- Pre-deployment checklist
- Step-by-step deployment procedure
- Rollback procedure
- Troubleshooting guide
- Monitoring & alerting
- Common issues & solutions
- Emergency contacts

---

## Execution Commands

### Phase 1: Remove Redundant Files

```bash
cd /Users/blah/files/unsynced/projects/zoku

# Remove redundant authentication docs
rm docs/authentication-review-2025-12-16.md
rm docs/authentication-implementation-progress.md
rm docs/global-authentication-strategy.md
rm docs/global-auth-implementation-summary.md

# Remove completed task docs
rm docs/ux-improvements-2025-12-16.md

# Remove outdated analysis
rm docs/deep-analysis-2025-12-11-updated.md
rm docs/refactoring-plan-great-game.md
```

### Phase 2: Verify Remaining Files

```bash
# List all markdown files
ls -lh docs/*.md

# Expected files (8 total):
# - CLAUDE.md (master context)
# - README.md (project overview)
# - docs/authentication.md (auth documentation)
# - docs/cloudflare-access-bypass-config.md (CF Access setup)
# - docs/admin-pages-security-review.md (security audit)
# - docs/audit-logging-events.md (event reference)
# - docs/zoku-spec.md (spec - needs update)
# - docs/DEPLOYMENT_READY.md (deployment - needs expansion)
# - docs/COMPREHENSIVE_ANALYSIS_2025-12-16.md (this analysis)
# - docs/DOCUMENTATION_CLEANUP_PLAN.md (this plan)
# - docs/mcp-implementation-review.md (MCP review - keep for reference)
```

### Phase 3: Update Outdated Files

See sections below for specific updates needed.

### Phase 4: Git Commit

```bash
git add docs/
git commit -m "docs: consolidate documentation, remove redundant files

- Remove 7 redundant/outdated docs (3,416 lines)
- Keep 8 essential docs (2,349 lines + new analysis)
- Add comprehensive analysis synthesizing all reviews
- Add documentation cleanup plan
- Reduces doc count by 50% while improving clarity"
```

---

## Post-Cleanup Documentation Structure

```
docs/
├── COMPREHENSIVE_ANALYSIS_2025-12-16.md   # Complete codebase review
├── DOCUMENTATION_CLEANUP_PLAN.md          # This file
├── PRODUCTION_RUNBOOK.md                  # To be created
├── authentication.md                       # Complete auth guide
├── cloudflare-access-bypass-config.md     # CF Access setup
├── admin-pages-security-review.md         # Security audit
├── audit-logging-events.md                # Event reference
├── zoku-spec.md                           # Project spec (needs update)
├── DEPLOYMENT_READY.md                    # Deployment guide (needs expansion)
└── mcp-implementation-review.md           # MCP review

Root level:
├── CLAUDE.md                              # Master context document
└── README.md                              # Project overview
```

**Total**: 10 focused documents vs. 14 redundant ones

---

## Updates Needed

### A. Update `docs/zoku-spec.md`

**Add after Phase 5 section**:

```markdown
### Phase 5.7: Authentication System ✅ COMPLETE
**Status**: Complete
**Duration**: 1 week

#### Features Implemented
- Four-tier access control (observed, coherent, entangled, prime)
- Cloudflare Access integration for web UI
- OAuth 2.1 for MCP (RFC 8414 compliant, PKCE, dynamic registration)
- Personal Access Tokens (PAT) with revocation
- Session management (track and revoke OAuth sessions)
- Audit logging for security events (9 event types)
- Dev mode (skip JWT validation for local testing)

#### Key Files
- `src/middleware/auth.ts` - Web authentication
- `src/lib/cf-access.ts` - CF Access JWT validation
- `src/lib/mcp-oauth.ts` - OAuth 2.1 server
- `src/lib/mcp-tokens.ts` - PAT generation/validation
- `src/api/mcp-oauth.ts` - OAuth endpoints + UI
- `src/api/mcp-tokens.ts` - PAT management API
- `frontend/src/lib/auth.tsx` - Auth context
- `frontend/src/components/AccountPage.tsx` - Token management UI

See `docs/authentication.md` for complete documentation.

### Phase 6: Production Deployment ⏳ READY
**Status**: Ready (infrastructure setup required)
**Estimated Duration**: 4-6 hours

#### Prerequisites
- Cloudflare Access application (30 min)
- AUTH_KV namespace creation (10 min)
- Production secrets configuration (15 min)
- Database migrations (10 min)
- First Prime user creation (5 min)
- Frontend build (5 min)
- Deployment (10 min)
- Testing (2-3 hours)

#### Blockers
- None (code is production-ready)
- Infrastructure setup is manual one-time task

See `docs/PRODUCTION_RUNBOOK.md` for deployment procedures.
```

**Update Architecture section**:

```markdown
### Authentication

The system uses a four-tier access control model:

| Tier | Level | Access | Use Case |
|------|-------|--------|----------|
| observed | 0 | None | Pre-created for PASCI, no real access |
| coherent | 1 | Read + jewel mgmt | New users, guests, viewers |
| entangled | 2 | Full CRUD | Team members, contributors |
| prime | 3 | Admin | System administrators |

**Web UI**: Cloudflare Access JWT (production) or dev JWT (local)
**MCP**: OAuth 2.1 (primary) or Personal Access Tokens (fallback)

See `docs/authentication.md` for complete documentation.
```

### B. Expand `docs/DEPLOYMENT_READY.md`

**Add sections**:

1. **Pre-Deployment Checklist**
   - Security fixes required
   - Infrastructure setup steps
   - Secret generation commands
   - Documentation review

2. **Deployment Procedure**
   - Step-by-step commands with expected output
   - Verification steps after each command
   - Common errors and fixes

3. **Rollback Procedure**
   - When to rollback (decision criteria)
   - Worker rollback command
   - Database rollback procedure
   - Verification steps

4. **Post-Deployment Testing**
   - Web UI authentication flow
   - MCP OAuth flow
   - PAT generation and usage
   - CRUD operations
   - Token revocation

5. **Monitoring Setup**
   - Cloudflare dashboard configuration
   - Key metrics to watch
   - Alert thresholds
   - Log querying examples

6. **Troubleshooting**
   - Common issues and solutions
   - OAuth not working (discovery, token exchange)
   - Token validation failures
   - CF Access issues
   - KV errors

---

## Benefits of Cleanup

1. **Reduced Confusion**: 50% fewer docs, no redundancy
2. **Easier Maintenance**: Single source of truth for each topic
3. **Better Onboarding**: Clear documentation structure
4. **Current Information**: Outdated docs removed
5. **Focused Reading**: Each doc has specific purpose

---

## Timeline

- **Phase 1** (Remove files): 5 minutes
- **Phase 2** (Verify): 5 minutes
- **Phase 3** (Update zoku-spec.md): 30 minutes
- **Phase 4** (Expand DEPLOYMENT_READY.md): 1-2 hours
- **Phase 5** (Create PRODUCTION_RUNBOOK.md): 2-3 hours
- **Phase 6** (Git commit): 5 minutes

**Total**: 4-6 hours

---

## Success Criteria

- ✅ 7 redundant files removed
- ✅ All essential content preserved in consolidated docs
- ✅ `zoku-spec.md` updated with Phase 5.7 and 6
- ✅ `DEPLOYMENT_READY.md` expanded with complete procedures
- ✅ `PRODUCTION_RUNBOOK.md` created with operations guide
- ✅ Documentation structure clear and maintainable
- ✅ Git history preserved (files removed via git rm)

---

## Next Actions

1. **Review this plan** with team (15 min)
2. **Execute Phase 1** (remove redundant files) - 5 min
3. **Execute Phase 2** (verify structure) - 5 min
4. **Execute Phase 3** (update outdated files) - 30 min to 2 hours
5. **Execute Phase 4** (create runbook) - 2-3 hours
6. **Commit changes** to git - 5 min

**Total effort**: 3-6 hours (depending on runbook detail level)
