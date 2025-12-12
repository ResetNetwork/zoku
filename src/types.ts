// Shared TypeScript types

export interface Bindings {
  DB: D1Database;
  ENCRYPTION_KEY: string;
}

export interface Volition {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface Entangled {
  id: string;
  name: string;
  description?: string | null;
  type: 'human' | 'agent';
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

export interface Credential {
  id: string;
  name: string;
  type: string;
  data: string;  // Encrypted JSON
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

export interface VolitionAttribute {
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
