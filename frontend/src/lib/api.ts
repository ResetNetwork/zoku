import type { Entanglement, Qupt, Zoku, PASCIMatrix, Source } from './types'

const API_BASE = '/api'

export const api = {
  // Volitions
  async listEntanglements(params?: { root_only?: boolean; limit?: number; detailed?: boolean }) {
    const query = new URLSearchParams()
    if (params?.root_only) query.set('root_only', 'true')
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.detailed) query.set('detailed', 'true')

    const res = await fetch(`${API_BASE}/entanglements?${query}`)
    const data = await res.json()
    return data.entanglements as Entanglement[]
  },

  async getEntanglement(id: string, detailed = false) {
    const res = await fetch(`${API_BASE}/entanglements/${id}?detailed=${detailed}`)
    return await res.json() as Entanglement
  },

  // Qupts
  async listQupts(entanglementId: string, params?: { source?: string; limit?: number; detailed?: boolean }) {
    const query = new URLSearchParams({ entanglement_id: volitionId })
    if (params?.source) query.set('source', params.source)
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.detailed) query.set('detailed', 'true')

    const res = await fetch(`${API_BASE}/qupts?${query}`)
    const data = await res.json()
    return data.qupts as Qupt[]
  },

  // Entangled
  async listZoku() {
    const res = await fetch(`${API_BASE}/zoku`)
    const data = await res.json()
    return data.zoku as Zoku[]
  },

  async getZoku(id: string) {
    const res = await fetch(`${API_BASE}/zoku/${id}`)
    return await res.json() as Zoku
  },

  async createZoku(data: { name: string; type: 'human' | 'agent' }) {
    const res = await fetch(`${API_BASE}/zoku`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return await res.json() as Zoku
  },

  async updateZoku(id: string, data: { name?: string; description?: string; metadata?: any }) {
    const res = await fetch(`${API_BASE}/zoku/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return await res.json()
  },

  // Matrix
  async getZokuMatrix(entanglementId: string) {
    const res = await fetch(`${API_BASE}/entanglements/${volitionId}/matrix`)
    const data = await res.json()
    return data.matrix as PASCIMatrix
  },

  async assignToMatrix(entanglementId: string, zokuId: string, role: string) {
    const res = await fetch(`${API_BASE}/entanglements/${volitionId}/matrix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zoku_id: entangledId, role })
    })
    return await res.json()
  },

  // Dimensions
  async listDimensions() {
    const res = await fetch(`${API_BASE}/dimensions`)
    const data = await res.json()
    return data
  },

  async getEntanglementAttributes(entanglementId: string) {
    const res = await fetch(`${API_BASE}/entanglements/${volitionId}/attributes`)
    return await res.json()
  },

  async setEntanglementAttributes(entanglementId: string, attributes: Array<{ dimension: string; value: string }>) {
    const res = await fetch(`${API_BASE}/entanglements/${volitionId}/attributes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attributes })
    })
    return await res.json()
  },

  // Sources
  async listSources(entanglementId: string) {
    const res = await fetch(`${API_BASE}/entanglements/${volitionId}/sources`)
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
  async listJewels() {
    const res = await fetch(`${API_BASE}/jewels`)
    const data = await res.json()
    return data.jewels || []
  },

  async createJewel(credential: { name: string; type: string; data: any }) {
    console.log('📡 API: Creating credential...', { name: credential.name, type: credential.type })
    const res = await fetch(`${API_BASE}/jewels`, {
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

  async updateJewel(id: string, data: { name?: string; data?: any }) {
    const res = await fetch(`${API_BASE}/jewels/${id}`, {
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

  async deleteJewel(id: string) {
    const res = await fetch(`${API_BASE}/jewels/${id}`, {
      method: 'DELETE'
    })
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error?.message || 'Failed to delete credential')
    }
    return res.json()
  }
}
