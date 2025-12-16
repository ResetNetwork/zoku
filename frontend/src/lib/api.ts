import type { Entanglement, Qupt, Zoku, PASCIMatrix, Source, AccessTier } from './types'

const API_BASE = '/api'

// Initialize session tracking
function initSession(): string {
  let sessionId = sessionStorage.getItem('zoku_session')
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    sessionStorage.setItem('zoku_session', sessionId)
    console.log('🎫 Session started:', sessionId)
  }
  return sessionId
}

export const SESSION_ID = initSession()

// Helper to create fetch headers with session ID
function getHeaders(additionalHeaders?: Record<string, string>): HeadersInit {
  return {
    'X-Zoku-Session-ID': SESSION_ID,
    ...additionalHeaders
  }
}

export const api = {
  // Volitions
  async listEntanglements(params?: { root_only?: boolean; limit?: number; detailed?: boolean }) {
    const query = new URLSearchParams()
    if (params?.root_only) query.set('root_only', 'true')
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.detailed) query.set('detailed', 'true')

    const res = await fetch(`${API_BASE}/entanglements?${query}`, {
      headers: getHeaders()
    })
    const data = await res.json()
    return data.entanglements as Entanglement[]
  },

  async getEntanglement(id: string, detailed = false) {
    const res = await fetch(`${API_BASE}/entanglements/${id}?detailed=${detailed}`, {
      headers: getHeaders()
    })
    return await res.json() as Entanglement
  },

  async createEntanglement(data: { name: string; description?: string; parent_id?: string }) {
    const res = await fetch(`${API_BASE}/entanglements`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    })
    return await res.json() as Entanglement
  },

  // Qupts
  async listQupts(entanglementId: string, params?: { source?: string; limit?: number; detailed?: boolean }) {
    const query = new URLSearchParams({ entanglement_id: entanglementId })
    if (params?.source) query.set('source', params.source)
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.detailed) query.set('detailed', 'true')

    const res = await fetch(`${API_BASE}/qupts?${query}`, {
      headers: getHeaders()
    })
    const data = await res.json()
    return data.qupts as Qupt[]
  },

  async createQupt(data: { entanglement_id: string; content: string; source?: string; metadata?: any }) {
    const res = await fetch(`${API_BASE}/qupts`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    })
    return await res.json() as Qupt
  },

  // Zoku
  async listZoku() {
    const res = await fetch(`${API_BASE}/zoku`, {
      headers: getHeaders()
    })
    const data = await res.json()
    return data.zoku as Zoku[]
  },

  async getZoku(id: string) {
    const res = await fetch(`${API_BASE}/zoku/${id}`, {
      headers: getHeaders()
    })
    return await res.json() as Zoku
  },

  async createZoku(data: { name: string; type: 'human' | 'agent'; email?: string }) {
    const res = await fetch(`${API_BASE}/zoku`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    })
    return await res.json() as Zoku
  },

  async updateZoku(id: string, data: { name?: string; description?: string; metadata?: any }) {
    const res = await fetch(`${API_BASE}/zoku/${id}`, {
      method: 'PATCH',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    })
    return await res.json()
  },

  // Matrix
  async getZokuMatrix(entanglementId: string) {
    const res = await fetch(`${API_BASE}/entanglements/${entanglementId}/matrix`, {
      headers: getHeaders()
    })
    const data = await res.json()
    return data.matrix as PASCIMatrix
  },

  async assignToMatrix(entanglementId: string, zokuId: string, role: string) {
    const res = await fetch(`${API_BASE}/entanglements/${entanglementId}/matrix`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ zoku_id: zokuId, role })
    })
    return await res.json()
  },

  // Dimensions
  async listDimensions() {
    const res = await fetch(`${API_BASE}/dimensions`, {
      headers: getHeaders()
    })
    const data = await res.json()
    return data
  },

  async getEntanglementAttributes(entanglementId: string) {
    const res = await fetch(`${API_BASE}/entanglements/${entanglementId}/attributes`, {
      headers: getHeaders()
    })
    return await res.json()
  },

  async setEntanglementAttributes(entanglementId: string, attributes: Array<{ dimension: string; value: string }>) {
    const res = await fetch(`${API_BASE}/entanglements/${entanglementId}/attributes`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ attributes })
    })
    return await res.json()
  },

  // Sources
  async listSources(entanglementId: string) {
    const res = await fetch(`${API_BASE}/entanglements/${entanglementId}/sources`, {
      headers: getHeaders()
    })
    const data = await res.json()
    return data.sources as Source[]
  },

  async syncSource(sourceId: string) {
    const res = await fetch(`${API_BASE}/sources/${sourceId}/sync`, {
      method: 'POST',
      headers: getHeaders()
    })
    return await res.json()
  },

  // Credentials
  async listJewels() {
    const res = await fetch(`${API_BASE}/jewels`, {
      headers: getHeaders()
    })
    const data = await res.json()
    return data.jewels || []
  },

  async createJewel(credential: { name: string; type: string; data: any; oauth_app_id?: string }) {
    console.log('📡 API: Creating jewel...', { name: credential.name, type: credential.type })
    const res = await fetch(`${API_BASE}/jewels`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(credential)
    })
    console.log('📡 API: Response status:', res.status)
    const data = await res.json()
    console.log('📡 API: Response data:', data)
    if (data.error) {
      throw new Error(data.error.message || 'Failed to create jewel')
    }
    return data
  },

  async updateJewel(id: string, data: { name?: string; data?: any }) {
    const res = await fetch(`${API_BASE}/jewels/${id}`, {
      method: 'PATCH',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    })
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error?.message || 'Failed to update jewel')
    }
    return res.json()
  },

  async deleteJewel(id: string) {
    const res = await fetch(`${API_BASE}/jewels/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    })
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error?.message || 'Failed to delete jewel')
    }
    return res.json()
  },

  // User management (Prime only)
  async updateZokuTier(zokuId: string, tier: AccessTier) {
    const res = await fetch(`${API_BASE}/zoku/${zokuId}/tier`, {
      method: 'PATCH',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ tier })
    })
    if (!res.ok) {
      throw new Error('Failed to update tier')
    }
    return await res.json()
  }
}
