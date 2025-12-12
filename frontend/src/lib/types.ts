export interface Volition {
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
  children?: Volition[]
  matrix?: PASCIMatrix
  attributes?: Record<string, any>
  qupts?: Qupt[]
}

export interface Qupt {
  id: string
  entanglement_id: string
  volition_name?: string | null
  zoku_id?: string | null
  content: string
  source: string
  external_id?: string | null
  metadata?: string | Record<string, any>
  created_at: number
}

export interface Entangled {
  id: string
  name: string
  description?: string | null
  type: 'human' | 'agent'
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
  volitions?: Array<{
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
