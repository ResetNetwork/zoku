# Documentation Cleanup Plan - December 2025

## Current State
22 markdown files (300+ KB) in docs/ with significant redundancy and historical cruft.

## Cleanup Strategy

### Archive Historical Session Documents (12 files → archive/)
These are point-in-time session summaries that served their purpose but are no longer needed for reference:

```bash
mkdir -p docs/archive/2025-12-16-session
mv docs/authentication-review-2025-12-16.md docs/archive/2025-12-16-session/
mv docs/authentication-implementation-progress.md docs/archive/2025-12-16-session/
mv docs/global-authentication-strategy.md docs/archive/2025-12-16-session/
mv docs/global-auth-implementation-summary.md docs/archive/2025-12-16-session/
mv docs/ux-improvements-2025-12-16.md docs/archive/2025-12-16-session/
mv docs/SECURITY_FIXES_2025-12-16.md docs/archive/2025-12-16-session/
mv docs/SECURITY_FIXES_COMPLETE.md docs/archive/2025-12-16-session/
mv docs/SESSION_SUMMARY_2025-12-16.md docs/archive/2025-12-16-session/
mv docs/ARCHITECTURE_IMPROVEMENT_VALIDATION.md docs/archive/2025-12-16-session/
mv docs/MCP_MIGRATION_REMAINING.md docs/archive/2025-12-16-session/
mv docs/MIGRATION_COMPLETE.md docs/archive/2025-12-16-session/
mv docs/DEPLOYMENT_READY.md docs/archive/2025-12-16-session/
```

**Rationale:** These documented progress during a specific session. Work is complete and final state is documented elsewhere.

### Archive Pre-Refactor Planning Docs (3 files → archive/planning/)
These are planning documents for work that's now complete:

```bash
mkdir -p docs/archive/planning
mv docs/refactoring-plan-great-game.md docs/archive/planning/
mv docs/deep-analysis-2025-12-11-updated.md docs/archive/planning/
mv docs/mcp-implementation-review.md docs/archive/planning/
```

**Rationale:** Historical planning docs superseded by implementation and current architecture docs.

### Keep Core Reference Documents (7 files)
These remain essential for ongoing development:

**Architecture & Design:**
- ✅ `MCP_ARCHITECTURE_DECISION.md` (15K) - Why we chose service layer over REST-calling-MCP
- ✅ `SHARED_SERVICE_LAYER_PLAN.md` (27K) - Service layer architecture and implementation guide
- ✅ `COMPREHENSIVE_ANALYSIS_2025-12-16.md` (37K) - Complete system analysis and status

**Authentication & Security:**
- ✅ `authentication.md` (15K) - Complete authentication system documentation
- ✅ `admin-pages-security-review.md` (11K) - Security review and recommendations
- ✅ `audit-logging-events.md` (5.4K) - Audit event reference

**Planning (to be created):**
- ✅ `DOCUMENTATION_CLEANUP_PLAN.md` (10K) - This plan (rename to archive/ after execution)

## Final Structure

```
docs/
├── MCP_ARCHITECTURE_DECISION.md          # Architecture decisions
├── SHARED_SERVICE_LAYER_PLAN.md          # Service layer guide
├── COMPREHENSIVE_ANALYSIS_2025-12-16.md  # System analysis
├── authentication.md                      # Auth documentation
├── admin-pages-security-review.md        # Security review
├── audit-logging-events.md               # Event reference
└── archive/                               # Historical docs
    ├── 2025-12-16-session/               # Session progress docs
    │   ├── authentication-review-2025-12-16.md
    │   ├── authentication-implementation-progress.md
    │   ├── global-authentication-strategy.md
    │   ├── global-auth-implementation-summary.md
    │   ├── ux-improvements-2025-12-16.md
    │   ├── SECURITY_FIXES_2025-12-16.md
    │   ├── SECURITY_FIXES_COMPLETE.md
    │   ├── SESSION_SUMMARY_2025-12-16.md
    │   ├── ARCHITECTURE_IMPROVEMENT_VALIDATION.md
    │   ├── MCP_MIGRATION_REMAINING.md
    │   ├── MIGRATION_COMPLETE.md
    │   └── DEPLOYMENT_READY.md
    └── planning/                          # Pre-implementation planning
        ├── refactoring-plan-great-game.md
        ├── deep-analysis-2025-12-11-updated.md
        └── mcp-implementation-review.md
```

## Execution

Run this script to execute the cleanup:

```bash
#!/bin/bash
cd /Users/blah/files/unsynced/projects/zoku

# Create archive directories
mkdir -p docs/archive/2025-12-16-session
mkdir -p docs/archive/planning

# Archive session documents
mv docs/authentication-review-2025-12-16.md docs/archive/2025-12-16-session/
mv docs/authentication-implementation-progress.md docs/archive/2025-12-16-session/
mv docs/global-authentication-strategy.md docs/archive/2025-12-16-session/
mv docs/global-auth-implementation-summary.md docs/archive/2025-12-16-session/
mv docs/ux-improvements-2025-12-16.md docs/archive/2025-12-16-session/
mv docs/SECURITY_FIXES_2025-12-16.md docs/archive/2025-12-16-session/
mv docs/SECURITY_FIXES_COMPLETE.md docs/archive/2025-12-16-session/
mv docs/SESSION_SUMMARY_2025-12-16.md docs/archive/2025-12-16-session/
mv docs/ARCHITECTURE_IMPROVEMENT_VALIDATION.md docs/archive/2025-12-16-session/
mv docs/MCP_MIGRATION_REMAINING.md docs/archive/2025-12-16-session/
mv docs/MIGRATION_COMPLETE.md docs/archive/2025-12-16-session/
mv docs/DEPLOYMENT_READY.md docs/archive/2025-12-16-session/

# Archive planning documents
mv docs/refactoring-plan-great-game.md docs/archive/planning/
mv docs/deep-analysis-2025-12-11-updated.md docs/archive/planning/
mv docs/mcp-implementation-review.md docs/archive/planning/

# Archive old cleanup plan
mv docs/DOCUMENTATION_CLEANUP_PLAN.md docs/archive/2025-12-16-session/

# Archive this plan after execution
# mv docs/CLEANUP_PLAN_CURRENT.md docs/archive/

echo "✅ Documentation cleanup complete!"
echo "Kept: 6 core reference documents"
echo "Archived: 15 historical/planning documents"
```

## Result

- **Before:** 22 files, redundant content, hard to navigate
- **After:** 6 essential reference docs + organized archive
- **Reduction:** 73% fewer files in main docs/

Core documentation remains accessible while historical context is preserved for reference.
