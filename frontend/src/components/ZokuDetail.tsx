import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useNotifications } from '../lib/notifications'
import type { AccessTier } from '../lib/types'

interface ZokuDetailProps {
  zokuId: string
  onSelectEntanglement: (id: string) => void
}

export default function ZokuDetail({ zokuId, onSelectEntanglement }: ZokuDetailProps) {
  const { user } = useAuth()
  const { addNotification } = useNotifications()
  const isPrime = user?.access_tier === 'prime'
  const [isEditing, setIsEditing] = useState(false)
  const [changingTier, setChangingTier] = useState(false)
  const [newTier, setNewTier] = useState<AccessTier>('observed')
  const [formData, setFormData] = useState({
    description: '',
    github_username: '',
    email: '',
    role: '',
    org: '',
    timezone: '',
    deal_id: ''
  })
  const queryClient = useQueryClient()

  const { data: zoku, isLoading } = useQuery({
    queryKey: ['zoku', zokuId],
    queryFn: () => api.getZoku(zokuId)
  })

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  const handleEdit = () => {
    if (zoku) {
      setFormData({
        description: zoku.description || '',
        github_username: zoku.metadata?.github_username || '',
        email: zoku.metadata?.email || '',
        role: zoku.metadata?.role || '',
        org: zoku.metadata?.org || '',
        timezone: zoku.metadata?.timezone || '',
        deal_id: zoku.metadata?.deal_id || ''
      })
      setIsEditing(true)
    }
  }

  const handleSave = async () => {
    if (!zoku) return

    await api.updateZoku(zokuId, {
      description: formData.description || undefined,
      metadata: {
        github_username: formData.github_username || undefined,
        email: formData.email || undefined,
        role: formData.role || undefined,
        org: formData.org || undefined,
        timezone: formData.timezone || undefined,
        deal_id: formData.deal_id || undefined
      }
    })

    queryClient.invalidateQueries({ queryKey: ['zoku', zokuId] })
    setIsEditing(false)
  }

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      perform: 'bg-purple-500/20 text-purple-300',
      accountable: 'bg-blue-500/20 text-blue-300',
      control: 'bg-red-500/20 text-red-300',
      support: 'bg-yellow-500/20 text-yellow-300',
      informed: 'bg-green-500/20 text-green-300'
    }
    return colors[role] || 'bg-gray-500/20 text-gray-300'
  }

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      perform: 'Perform',
      accountable: 'Accountable',
      control: 'Control',
      support: 'Support',
      informed: 'Informed'
    }
    return labels[role] || role
  }

  if (isLoading) {
    return <div className="text-center text-gray-400 py-12">Loading...</div>
  }

  if (!zoku) {
    return <div className="text-center text-gray-400 py-12">Zoku partner not found</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <span className="text-5xl">
              {zoku.type === 'human' ? '👤' : '🤖'}
            </span>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-quantum-400 mb-1">{zoku.name}</h1>
              <p className="text-gray-400">{zoku.type === 'human' ? 'Human Partner' : 'AI Agent'}</p>
            </div>
          </div>
          {isEditing ? (
            <div className="flex gap-2">
              <button onClick={handleSave} className="btn btn-primary">
                Save
              </button>
              <button onClick={() => setIsEditing(false)} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={handleEdit} className="btn btn-secondary">
              Edit
            </button>
          )}
        </div>
        {zoku.description && (
          <p className="text-gray-600 dark:text-gray-300 mb-3">{zoku.description}</p>
        )}
        <div className="text-sm text-gray-500">
          Created {formatDate(zoku.created_at)}
        </div>
      </div>

      {/* Details / Edit Form */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Details</h2>
          {isPrime && zoku && (
            <button
              onClick={() => {
                setNewTier(zoku.access_tier)
                setChangingTier(true)
              }}
              className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm"
            >
              Change Access Tier
            </button>
          )}
        </div>

        {/* Tier Change Form */}
        {changingTier && zoku && (
          <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded">
            <h3 className="font-semibold mb-3 text-yellow-900 dark:text-yellow-100">Change Access Tier</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-yellow-900 dark:text-yellow-100">Current Tier</label>
                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded font-mono">
                  {zoku.access_tier}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-yellow-900 dark:text-yellow-100">New Tier</label>
                <select
                  value={newTier}
                  onChange={(e) => setNewTier(e.target.value as AccessTier)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded"
                >
                  <option value="observed">Observed (No Access)</option>
                  <option value="coherent">Coherent (Read Only)</option>
                  <option value="entangled">Entangled (Read-Write)</option>
                  <option value="prime">Prime (Admin)</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!confirm(`Change ${zoku.name}'s access tier from ${zoku.access_tier} to ${newTier}?`)) {
                      return
                    }
                    try {
                      const response = await fetch(`/api/zoku/${zokuId}/tier`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ access_tier: newTier })
                      })
                      if (!response.ok) throw new Error('Failed to update tier')
                      addNotification('success', `Access tier changed to ${newTier}`)
                      setChangingTier(false)
                      queryClient.invalidateQueries({ queryKey: ['zoku', zokuId] })
                    } catch (error) {
                      addNotification('error', 'Failed to change access tier')
                    }
                  }}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded"
                >
                  Confirm Change
                </button>
                <button
                  onClick={() => setChangingTier(false)}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-quantum-800 border border-gray-300 dark:border-quantum-600 rounded-md text-gray-900 dark:text-gray-100"
                rows={3}
                placeholder="Brief description..."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-500 mb-1">GitHub Username</label>
                <input
                  type="text"
                  value={formData.github_username}
                  onChange={(e) => setFormData({ ...formData, github_username: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-quantum-800 border border-gray-300 dark:border-quantum-600 rounded-md text-gray-900 dark:text-gray-100"
                  placeholder="username"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-quantum-800 border border-gray-300 dark:border-quantum-600 rounded-md text-gray-900 dark:text-gray-100"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Role</label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-quantum-800 border border-gray-300 dark:border-quantum-600 rounded-md text-gray-900 dark:text-gray-100"
                  placeholder="Developer, Designer, etc."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Organization</label>
                <input
                  type="text"
                  value={formData.org}
                  onChange={(e) => setFormData({ ...formData, org: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-quantum-800 border border-gray-300 dark:border-quantum-600 rounded-md text-gray-900 dark:text-gray-100"
                  placeholder="Company or team"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Timezone</label>
                <input
                  type="text"
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-quantum-800 border border-gray-300 dark:border-quantum-600 rounded-md text-gray-900 dark:text-gray-100"
                  placeholder="America/Los_Angeles"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Deal ID</label>
                <input
                  type="text"
                  value={formData.deal_id}
                  onChange={(e) => setFormData({ ...formData, deal_id: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-quantum-800 border border-gray-300 dark:border-quantum-600 rounded-md text-gray-900 dark:text-gray-100"
                  placeholder="DX40"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {zoku.description && (
              <p className="text-gray-600 dark:text-gray-300">{zoku.description}</p>
            )}
            {zoku.metadata && Object.keys(zoku.metadata).length > 0 ? (
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {zoku.metadata.github_username && (
                  <div>
                    <dt className="text-sm text-gray-500 mb-1">GitHub Username</dt>
                    <dd className="text-gray-900 dark:text-gray-100">@{zoku.metadata.github_username}</dd>
                  </div>
                )}
                {zoku.metadata.email && (
                  <div>
                    <dt className="text-sm text-gray-500 mb-1">Email</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{zoku.metadata.email}</dd>
                  </div>
                )}
                {zoku.metadata.role && (
                  <div>
                    <dt className="text-sm text-gray-500 mb-1">Role</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{zoku.metadata.role}</dd>
                  </div>
                )}
                {zoku.metadata.org && (
                  <div>
                    <dt className="text-sm text-gray-500 mb-1">Organization</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{zoku.metadata.org}</dd>
                  </div>
                )}
                {zoku.metadata.timezone && (
                  <div>
                    <dt className="text-sm text-gray-500 mb-1">Timezone</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{zoku.metadata.timezone}</dd>
                  </div>
                )}
                {zoku.metadata.deal_id && (
                  <div>
                    <dt className="text-sm text-gray-500 mb-1">Deal</dt>
                    <dd className="text-gray-900 dark:text-gray-100">
                      <a
                        href={`https://deals.reset.tech/?deal_id=${zoku.metadata.deal_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-quantum-500 hover:text-quantum-400 underline inline-flex items-center gap-1"
                      >
                        {zoku.metadata.deal_id}
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-gray-400 text-sm">No additional details. Click Edit to add information.</p>
            )}
          </div>
        )}
      </div>

      {/* Entanglements */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Entanglements</h2>
        {!zoku.entanglements || zoku.entanglements.length === 0 ? (
          <div className="text-gray-400 text-center py-8">Not assigned to any entanglements yet</div>
        ) : (
          <div className="space-y-2">
            {zoku.entanglements.map((vol: { id: string; name: string; roles: string[] }) => (
              <button
                key={vol.id}
                onClick={() => onSelectEntanglement(vol.id)}
                className="w-full text-left p-4 bg-gray-100 dark:bg-quantum-700/50 hover:bg-gray-200 dark:hover:bg-quantum-700 rounded-lg border border-gray-300 dark:border-quantum-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">{vol.name}</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      {vol.roles.map((role: string) => (
                        <span
                          key={role}
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(role)}`}
                        >
                          {getRoleLabel(role)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
