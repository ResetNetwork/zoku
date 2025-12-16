# Documentation

Essential reference documentation for The Great Game (Zoku Platform).

## Core Documentation

### Architecture & Implementation
- **[SHARED_SERVICE_LAYER_PLAN.md](SHARED_SERVICE_LAYER_PLAN.md)** - Service layer architecture guide
  - Why service layer approach was chosen
  - Complete implementation details
  - REST API and MCP integration patterns
  - Code reduction: 39% (4000→2458 lines)

- **[MCP_ARCHITECTURE_DECISION.md](MCP_ARCHITECTURE_DECISION.md)** - Architecture decision record
  - Why shared service layer vs REST-calling-MCP
  - Trade-offs and benefits analysis
  - Implementation complexity comparison

- **[COMPREHENSIVE_ANALYSIS_2025-12-16.md](COMPREHENSIVE_ANALYSIS_2025-12-16.md)** - Complete system analysis
  - Security review (Grade: 9/10)
  - Code quality assessment (Grade: 9.5/10)
  - Performance analysis (Grade: 8/10)
  - Documentation review (Grade: 9/10)
  - Testing status (Grade: 7.5/10)
  - Production readiness (Grade: 8/10)
  - Overall: 8.5/10

### Authentication & Security
- **[authentication.md](authentication.md)** - Complete authentication system documentation
  - OAuth 2.1 implementation (RFC 8414, PKCE, dynamic registration)
  - Personal Access Tokens (PAT)
  - Four-tier access control (observed, coherent, entangled, prime)
  - Session management
  - Cloudflare Access integration
  - Local development setup

- **[admin-pages-security-review.md](admin-pages-security-review.md)** - Security review and recommendations
  - Admin UI security analysis
  - Permission enforcement review
  - Recommendations and improvements

- **[audit-logging-events.md](audit-logging-events.md)** - Audit event reference
  - All audit event types
  - Event metadata structure
  - Example queries

## Archive

Historical and session-specific documentation is archived in `archive/`:

- **`archive/2025-12-16-session/`** - December 2025 development session docs
  - Authentication implementation progress
  - Security fixes and validation
  - Migration completion summaries
  - Session summaries and status updates

- **`archive/planning/`** - Pre-implementation planning docs
  - Original refactoring plans
  - Early system analyses
  - MCP implementation reviews

These are preserved for historical context but superseded by current documentation.

## Quick Start

**For developers:**
1. Start with [AGENTS.md](../AGENTS.md) in project root - complete project context
2. Review [SHARED_SERVICE_LAYER_PLAN.md](SHARED_SERVICE_LAYER_PLAN.md) - architecture overview
3. Check [authentication.md](authentication.md) - auth setup and testing

**For security review:**
1. [COMPREHENSIVE_ANALYSIS_2025-12-16.md](COMPREHENSIVE_ANALYSIS_2025-12-16.md) - system analysis
2. [admin-pages-security-review.md](admin-pages-security-review.md) - security review
3. [audit-logging-events.md](audit-logging-events.md) - audit events

**For production deployment:**
1. [authentication.md](authentication.md) - Cloudflare Access setup
2. [AGENTS.md](../AGENTS.md) - Database initialization and admin bootstrap
3. [COMPREHENSIVE_ANALYSIS_2025-12-16.md](COMPREHENSIVE_ANALYSIS_2025-12-16.md) - Production readiness checklist

## Documentation Cleanup

Documentation was cleaned up on December 16, 2025:
- **Before:** 22 files (300+ KB) with redundancy
- **After:** 7 core reference docs + organized archive
- **Result:** 68% reduction in active documentation, improved navigability

See [archive/CLEANUP_PLAN_CURRENT.md](archive/CLEANUP_PLAN_CURRENT.md) for cleanup details.
