# Audit Logging Events
**Date**: 2025-12-16  
**Status**: ✅ Implemented

## Overview

Audit logging captures security-sensitive operations for compliance, security monitoring, and forensics. All audit events are stored in the `audit_log` table and visible to **Prime tier** users only.

## Audited Events

### User Management (Zoku)

#### Create User
- **Action**: `create`
- **Resource Type**: `zoku`
- **Who Can**: Entangled, Prime
- **Triggered By**: `POST /api/zoku`
- **Details**: `{ name, type, email, tier }`

#### Delete User  
- **Action**: `delete`
- **Resource Type**: `zoku`
- **Who Can**: Entangled, Prime (cannot delete self)
- **Triggered By**: `DELETE /api/zoku/:id`
- **Details**: `{ name, type, email }`

#### Change User Tier
- **Action**: `tier_change`
- **Resource Type**: `zoku`
- **Who Can**: Prime only
- **Triggered By**: `PATCH /api/zoku/:id/tier`
- **Details**: `{ from: "observed", to: "prime" }`

### Personal Access Tokens (PAT)

#### Create PAT
- **Action**: `create`
- **Resource Type**: `pat_token`
- **Who Can**: Coherent, Entangled, Prime
- **Triggered By**: `POST /api/mcp-tokens`
- **Details**: `{ name: "My Token", expires_in_days: 30 }`

#### Revoke PAT
- **Action**: `revoke`
- **Resource Type**: `pat_token`
- **Who Can**: Token owner, Prime (can revoke any)
- **Triggered By**: `DELETE /api/mcp-tokens/:id`
- **Details**: `{ name: "My Token" }`

### OAuth Sessions

#### Authorize OAuth Session
- **Action**: `authorize`
- **Resource Type**: `oauth_session`
- **Who Can**: Any authenticated user
- **Triggered By**: `POST /oauth/authorize` (user approval)
- **Details**: `{ client_id: "client_...", scope: "mcp" }`

#### Revoke OAuth Session
- **Action**: `revoke`
- **Resource Type**: `oauth_session`
- **Who Can**: Session owner
- **Triggered By**: `DELETE /oauth/sessions/:id`
- **Details**: `{ action: "manual_revocation" }`

### Credentials (Jewels)

#### Create Jewel
- **Action**: `create`
- **Resource Type**: `jewel`
- **Who Can**: Coherent, Entangled, Prime
- **Triggered By**: `POST /api/jewels`
- **Details**: `{ name: "GitHub Token", type: "github" }`

#### Delete Jewel
- **Action**: `delete`
- **Resource Type**: `jewel`
- **Who Can**: Jewel owner, Prime (can delete any)
- **Triggered By**: `DELETE /api/jewels/:id`
- **Details**: `{ name: "GitHub Token", type: "github" }`

## Audit Log Schema

```typescript
interface AuditLog {
  id: string;              // log-{uuid}
  timestamp: number;       // Unix timestamp
  zoku_id: string;         // Who performed the action
  action: string;          // create, delete, update, authorize, revoke, tier_change
  resource_type: string;   // zoku, pat_token, oauth_session, jewel
  resource_id: string;     // ID of the affected resource
  details: string;         // JSON string with action-specific details
  ip_address: string | null;    // cf-connecting-ip header
  user_agent: string | null;    // User-Agent header
  request_id: string | null;    // Request correlation ID
}
```

## What is NOT Audited

### Regular Operations (Tracked as Qupts)
- Creating/updating/deleting entanglements
- Creating/updating/deleting qupts (activity)
- Assigning PASCI responsibilities
- Setting taxonomy attributes
- Adding/removing sources

**Why**: These are normal project management operations, not security events. They're tracked as `qupts` (activity records) instead.

### Read Operations
- Viewing entanglements, zoku, qupts
- Listing audit logs
- Viewing OAuth sessions
- Viewing PAT tokens

**Why**: Read-only operations don't change system state or pose security risks.

## Accessing Audit Logs

### Web UI
- **Prime users only**: Visit `/audit-log` view
- Filters: Resource type, action, limit (50/100/500/1000)
- Export: CSV download available

### API
```bash
GET /api/audit-logs?limit=100
Authorization: Bearer <jwt-token>  # Prime tier required
```

### Example Response
```json
{
  "logs": [
    {
      "id": "log-a8a56f68-1fe6-4d8d-b402-89ca94f20df9",
      "timestamp": 1765907697,
      "zoku_id": "zoku-22effa60-b681-40d9-aa13-d767997d9fe5",
      "action": "tier_change",
      "resource_type": "zoku",
      "resource_id": "zoku-6766cc77-e5fc-4c65-917a-4a6edcd7fb4d",
      "details": "{\"from\":\"observed\",\"to\":\"entangled\"}",
      "ip_address": null,
      "user_agent": "curl/8.7.1",
      "request_id": "69d32364"
    }
  ]
}
```

## Retention

- **Default**: Unlimited retention (D1 database)
- **Recommendation**: Implement retention policy based on compliance requirements
- **Future**: Add `DELETE /api/audit-logs` endpoint for Prime users to prune old logs

## Security Considerations

1. **Immutable**: Audit logs cannot be edited or deleted via API
2. **Access Control**: Only Prime tier can view audit logs
3. **Correlation**: All logs include `request_id` for tracing across systems
4. **IP Tracking**: Captures `cf-connecting-ip` when available (Cloudflare edge)
5. **Anonymity**: User agent logged but no PII beyond what's in the operation

## Compliance

Audit logging supports compliance with:
- **SOC 2**: Access control monitoring, change tracking
- **GDPR**: Data access and modification tracking
- **HIPAA**: User access audit trail (if handling PHI)
- **ISO 27001**: Information security event logging

## Future Enhancements

- [ ] MCP tool for querying audit logs
- [ ] Retention policy configuration
- [ ] Audit log streaming to external SIEM
- [ ] Failed login attempt tracking
- [ ] Rate limit violation tracking
- [ ] Scheduled reports (weekly email digest)
