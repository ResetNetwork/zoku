// Shared TypeScript types

export interface Bindings {
  DB: D1Database;
  ENCRYPTION_KEY: string;
  LOG_LEVEL?: string;
  // Cloudflare Access
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  // JWT for MCP tokens
  JWT_SECRET?: string;
  // OAuth KV storage
  AUTH_KV?: KVNamespace;
  // Development
  DEV_AUTH_BYPASS?: string;  // For web UI
  DEV_MCP_AUTH_BYPASS?: string;  // For MCP (separate from web)
  DEV_USER_EMAIL?: string;
  APP_URL?: string;
}

export interface Entanglement {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  created_at: number;
  updated_at: number;
}

export type AccessTier = 'observed' | 'coherent' | 'entangled' | 'prime';

export interface Zoku {
  id: string;
  name: string;
  description?: string | null;
  type: 'human' | 'agent';
  email: string | null;
  access_tier: AccessTier;
  cf_access_sub: string | null;
  last_login: number | null;
  created_by: string | null;
  updated_by: string | null;
  metadata: string | null;
  created_at: number;
}

export interface Qupt {
  id: string;
  entanglement_id: string;
  zoku_id: string | null;
  content: string;
  source: string;
  external_id: string | null;
  metadata: string | null;
  created_at: number;
}

export interface Jewel {
  id: string;
  name: string;
  type: string;
  data: string;  // Encrypted JSON
  owner_id: string | null;
  last_validated: number | null;
  validation_metadata: string | null;
  created_at: number;
  updated_at: number;
}

export interface Source {
  id: string;
  entanglement_id: string;
  type: string;
  config: string;
  credentials: string | null;  // Inline credentials (backward compat)
  jewel_id: string | null;  // Reference to credentials table
  enabled: number;
  last_sync: number | null;
  sync_cursor: string | null;
  last_error: string | null;
  error_count: number;
  last_error_at: number | null;
  created_at: number;
}

export interface Dimension {
  id: string;
  name: string;
  label: string;
  description: string | null;
  allow_multiple: number;
  parent_dimension_id: string | null;
  created_at: number;
}

export interface DimensionValue {
  id: string;
  dimension_id: string;
  value: string;
  label: string;
  description: string | null;
  parent_value_id: string | null;
  depends_on_value_id: string | null;
  sort_order: number;
  created_at: number;
}

export interface EntanglementAttribute {
  entanglement_id: string;
  dimension_id: string;
  value_id: string;
  assigned_at: number;
}

export type PASCIRole = 'perform' | 'accountable' | 'control' | 'support' | 'informed';

export interface MatrixAssignment {
  entanglement_id: string;
  zoku_id: string;
  role: PASCIRole;
  linked_at: number;
}

export interface QuptInput {
  entanglement_id: string;
  zoku_id?: string;
  content: string;
  source: string;
  external_id?: string;
  metadata?: Record<string, any>;
  created_at?: number;
}

export interface AuditLog {
  id: string;
  timestamp: number;
  zoku_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  details: string | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
}

export interface CloudflareAccessPayload {
  sub: string;
  email: string;
  iss: string;
  aud: string[];
  iat: number;
  exp: number;
  custom?: Record<string, any>;
}

export interface PatMetadata {
  id: string;
  name: string;
  created_at: number;
  expires_at: number;
  last_used: number | null;
}
