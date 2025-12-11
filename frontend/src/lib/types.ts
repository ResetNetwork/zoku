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
  children?: Volition[]
  matrix?: PASCIMatrix
  attributes?: Record<string, any>
  qupts?: Qupt[]
}

export interface Qupt {
  id: string
  volition_id: string
  entangled_id?: string | null
  content: string
  source: string
  external_id?: string | null
  metadata?: string | Record<string, any>
  created_at: number
}

export interface Entangled {
  id: string
  name: string
  type: 'human' | 'agent'
  metadata?: any
  created_at: number
}

export interface PASCIMatrix {
  perform: Entangled[]
  accountable: Entangled[]
  control: Entangled[]
  support: Entangled[]
  informed: Entangled[]
}

export interface Source {
  id: string
  type: string
  config: any
  enabled: number
  last_sync?: number | null
}
