// Shared TypeScript types
import type { Logger } from './lib/logger';

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
  // App configuration
  APP_URL?: string;
  // Admin user (automatically promoted to prime tier)
  ADMIN_EMAIL?: string;
}

// Variables available in Hono context
export interface Variables {
  user: Zoku;
  logger: Logger;
  request_id: string;
}

// Combined type for Hono app
export type HonoEnv = {
  Bindings: Bindings;
  Variables: Variables;
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

// Qupt type system - source:subtype format
export type QuptType =
  // GitHub
  | 'github:push'
  | 'github:pull_request'
  | 'github:issue'
  | 'github:issue_comment'
  | 'github:pr_comment'
  | 'github:release'
  // Zammad
  | 'zammad:ticket'
  | 'zammad:article'
  // Google Drive
  | 'gdrive:revision'
  | 'gdrive:comment'
  | 'gdrive:file_created'
  | 'gdrive:file_renamed'
  // Gmail
  | 'gmail:message'
  // Oubliette (agent sessions)
  | 'oubliette:session_started'
  | 'oubliette:session_completed'
  | 'oubliette:session_failed'
  // Manual
  | 'manual:note';

export interface Qupt {
  id: string;
  entanglement_id: string;
  zoku_id: string | null;
  content: string;
  source: string;
  qupt_type: QuptType | null;
  external_id: string | null;
  metadata: string | null;
  created_at: number;
}

export interface Jewel {
  id: string;
  name: string;
  type: string;
  data: string;  // Encrypted JSON
  oauth_app_id: string | null;  // Reference to oauth_applications table
  owner_id: string | null;
  last_validated: number | null;
  validation_metadata: string | null;
  created_at: number;
  updated_at: number;
}

export interface OAuthApplication {
  id: string;
  name: string;
  provider: string;  // 'google', 'microsoft', 'slack', etc.
  client_id: string;
  client_secret: string;  // Encrypted with ENCRYPTION_KEY
  scopes: string[] | string;  // JSON array of OAuth scopes
  metadata: Record<string, any> | string | null;  // Provider-specific config
  created_at: number;
  updated_at: number;
}

export interface Source {
  id: string;
  entanglement_id: string;
  type: string;
  config: string;
  credentials: string | null;  // Inline credentials (legacy support for sources created before jewel store)
  jewel_id: string | null;  // Reference to jewels table (preferred method)
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
  qupt_type?: QuptType;
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
