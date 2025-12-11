import type { Volition, Qupt, Entangled, PASCIMatrix, Source } from './types'

const API_BASE = '/api'

export const api = {
  // Volitions
  async listVolitions(params?: { root_only?: boolean; limit?: number; detailed?: boolean }) {
    const query = new URLSearchParams()
    if (params?.root_only) query.set('root_only', 'true')
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.detailed) query.set('detailed', 'true')

    const res = await fetch(`${API_BASE}/volitions?${query}`)
    const data = await res.json()
    return data.volitions as Volition[]
  },

  async getVolition(id: string, detailed = false) {
    const res = await fetch(`${API_BASE}/volitions/${id}?detailed=${detailed}`)
    return await res.json() as Volition
  },

  // Qupts
  async listQupts(volitionId: string, params?: { source?: string; limit?: number; detailed?: boolean }) {
    const query = new URLSearchParams({ volition_id: volitionId })
    if (params?.source) query.set('source', params.source)
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.detailed) query.set('detailed', 'true')

    const res = await fetch(`${API_BASE}/qupts?${query}`)
    const data = await res.json()
    return data.qupts as Qupt[]
  },

  // Entangled
  async listEntangled() {
    const res = await fetch(`${API_BASE}/entangled`)
    const data = await res.json()
    return data.entangled as Entangled[]
  },

  async getEntangled(id: string) {
    const res = await fetch(`${API_BASE}/entangled/${id}`)
    return await res.json() as Entangled
  },

  async createEntangled(data: { name: string; type: 'human' | 'agent' }) {
    const res = await fetch(`${API_BASE}/entangled`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return await res.json() as Entangled
  },

  async updateEntangled(id: string, data: { name?: string; description?: string; metadata?: any }) {
    const res = await fetch(`${API_BASE}/entangled/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return await res.json()
  },

  // Matrix
  async getMatrix(volitionId: string) {
    const res = await fetch(`${API_BASE}/volitions/${volitionId}/matrix`)
    const data = await res.json()
    return data.matrix as PASCIMatrix
  },

  async assignToMatrix(volitionId: string, entangledId: string, role: string) {
    const res = await fetch(`${API_BASE}/volitions/${volitionId}/matrix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entangled_id: entangledId, role })
    })
    return await res.json()
  },

  // Dimensions
  async listDimensions() {
    const res = await fetch(`${API_BASE}/dimensions`)
    const data = await res.json()
    return data
  },

  async getVolitionAttributes(volitionId: string) {
    const res = await fetch(`${API_BASE}/volitions/${volitionId}/attributes`)
    return await res.json()
  },

  async setVolitionAttributes(volitionId: string, attributes: Array<{ dimension: string; value: string }>) {
    const res = await fetch(`${API_BASE}/volitions/${volitionId}/attributes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attributes })
    })
    return await res.json()
  },

  // Sources
  async listSources(volitionId: string) {
    const res = await fetch(`${API_BASE}/volitions/${volitionId}/sources`)
    const data = await res.json()
    return data.sources as Source[]
  },

  async syncSource(sourceId: string) {
    const res = await fetch(`${API_BASE}/sources/${sourceId}/sync`, {
      method: 'POST'
    })
    return await res.json()
  },

  // Credentials
  async listCredentials() {
    const res = await fetch(`${API_BASE}/credentials`)
    const data = await res.json()
    return data.credentials || []
  },

  async createCredential(credential: { name: string; type: string; data: any }) {
    console.log('📡 API: Creating credential...', { name: credential.name, type: credential.type })
    const res = await fetch(`${API_BASE}/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credential)
    })
    console.log('📡 API: Response status:', res.status)
    const data = await res.json()
    console.log('📡 API: Response data:', data)
    if (data.error) {
      throw new Error(data.error.message || 'Failed to create credential')
    }
    return data
  },

  async updateCredential(id: string, data: { name?: string; data?: any }) {
    const res = await fetch(`${API_BASE}/credentials/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error?.message || 'Failed to update credential')
    }
    return res.json()
  },

  async deleteCredential(id: string) {
    const res = await fetch(`${API_BASE}/credentials/${id}`, {
      method: 'DELETE'
    })
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error?.message || 'Failed to delete credential')
    }
    return res.json()
  }
}
