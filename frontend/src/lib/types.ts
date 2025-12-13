export interface Entanglement {
  id: string
  name: string
  description?: string
  parent_id?: string | null
  created_at: number
  updated_at: number
  children_count?: number
  qupts_count?: number
  sources_count?: number
  zoku_count?: number
  children?: Entanglement[]
  matrix?: PASCIMatrix
  attributes?: Record<string, any>
  qupts?: Qupt[]
}

export interface Qupt {
  id: string
  entanglement_id: string
  entanglement_name?: string | null
  zoku_id?: string | null
  content: string
  source: string
  external_id?: string | null
  metadata?: string | Record<string, any>
  created_at: number
}

export type AccessTier = 'observed' | 'coherent' | 'entangled' | 'prime';

export interface Zoku {
  id: string
  name: string
  description?: string | null
  type: 'human' | 'agent'
  email: string | null
  access_tier: AccessTier
  cf_access_sub: string | null
  last_login: number | null
  created_by: string | null
  updated_by: string | null
  metadata?: {
    github_username?: string
    email?: string
    role?: string
    timezone?: string
    org?: string
    deal_id?: string
    [key: string]: any
  }
  created_at: number
  entanglements?: Array<{
    id: string
    name: string
    created_at: number
    roles: string[]
  }>
}

export interface PASCIMatrix {
  perform: Zoku[]
  accountable: Zoku[]
  control: Zoku[]
  support: Zoku[]
  informed: Zoku[]
}

export interface Source {
  id: string
  type: string
  config: any
  enabled: number
  last_sync?: number | null
  last_error?: string | null
  error_count?: number
  last_error_at?: number | null
  credential?: {
    id: string
    name: string
    email: string | null
  } | null
}

export interface Jewel {
  id: string
  name: string
  type: string
  owner_id: string | null
  last_validated: number | null
  validation_metadata: Record<string, any> | null
  created_at: number
  updated_at: number
}

export interface PatMetadata {
  id: string
  name: string
  created_at: number
  expires_at: number
  last_used: number | null
}
