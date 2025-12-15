import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useNotifications } from '../lib/notifications'

interface ZokuListProps {
  onSelectZoku: (id: string) => void
  onSelectEntanglement: (id: string) => void
}

export default function ZokuList({ onSelectZoku, onSelectEntanglement }: ZokuListProps) {
  const { user } = useAuth()
  const { addNotification } = useNotifications()
  const [showAllMatrix, setShowAllMatrix] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newZokuName, setNewZokuName] = useState('')
  const [newZokuType, setNewZokuType] = useState<'human' | 'agent'>('human')
  const [newZokuEmail, setNewZokuEmail] = useState('')
  const [saving, setSaving] = useState(false)

  const canWrite = user?.access_tier === 'entangled' || user?.access_tier === 'prime'

  const { data: zoku = [], isLoading } = useQuery({
    queryKey: ['zoku'],
    queryFn: () => api.listZoku()
  })

  const { data: entanglements = [] } = useQuery({
    queryKey: ['all-entanglements'],
    queryFn: () => api.listEntanglements({ limit: 100 })
  })

  const { data: matrices = [] } = useQuery({
    queryKey: ['all-matrices', entanglements.map(v => v.id).join(',')],
    queryFn: async () => {
      if (entanglements.length === 0) return []
      const results = await Promise.all(
        entanglements.map(async v => ({
          entanglement_id: v.id,
          entanglement_name: v.name,
          matrix: await api.getZokuMatrix(v.id)
        }))
      )
      return results
    },
    enabled: entanglements.length > 0
  })

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  const pasciRoles = [
    { key: 'perform', label: 'Perform', color: 'text-purple-400' },
    { key: 'accountable', label: 'Accountable', color: 'text-blue-400' },
    { key: 'control', label: 'Control', color: 'text-red-400' },
    { key: 'support', label: 'Support', color: 'text-yellow-400' },
    { key: 'informed', label: 'Informed', color: 'text-green-400' }
  ]

  // Sort matrices alphabetically by entanglement name
  const sortedMatrices = [...matrices].sort((a, b) =>
    a.entanglement_name.localeCompare(b.entanglement_name)
  )

  const displayedMatrices = showAllMatrix ? sortedMatrices : sortedMatrices.slice(0, 5)

  if (isLoading) {
    return <div className="text-center text-gray-400 py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <h1 className="text-3xl font-bold text-quantum-400 mb-2">Zoku</h1>
        <p className="text-gray-400">People and AI agents working on entanglements</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Total Zoku</div>
          <div className="text-3xl font-bold text-quantum-400">{zoku.length}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Humans</div>
          <div className="text-3xl font-bold text-quantum-400">
            {zoku.filter(e => e.type === 'human').length}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">AI Agents</div>
          <div className="text-3xl font-bold text-quantum-400">
            {zoku.filter(e => e.type === 'agent').length}
          </div>
        </div>
      </div>

      {/* Responsibility Matrix */}
      {matrices.length > 0 && (
        <div className="card overflow-x-auto">
          <h2 className="text-xl font-bold mb-4">Responsibility Matrix</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-300 dark:border-quantum-600">
                <th className="text-left p-3 text-sm font-semibold text-gray-600 dark:text-gray-400">
                  Entanglement
                </th>
                {pasciRoles.map(role => (
                  <th
                    key={role.key}
                    className={`p-3 text-center text-sm font-semibold ${role.color}`}
                  >
                    {role.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedMatrices.map(({ entanglement_id, entanglement_name, matrix }) => (
                <tr
                  key={entanglement_id}
                  className="border-b border-gray-200 dark:border-quantum-700 hover:bg-gray-50 dark:hover:bg-quantum-800/30"
                >
                  <td className="p-3">
                    <button
                      onClick={() => onSelectEntanglement(entanglement_id)}
                      className="font-medium text-quantum-500 hover:text-quantum-400 transition-colors text-left"
                    >
                      {entanglement_name}
                    </button>
                  </td>
                  {pasciRoles.map(role => {
                    const entities = matrix[role.key as keyof typeof matrix] || []
                    return (
                      <td key={role.key} className="p-3 text-center">
                        {entities.length > 0 ? (
                          <div className="flex flex-wrap gap-1 justify-center">
                            {entities.map(e => (
                              <button
                                key={e.id}
                                onClick={() => onSelectZoku(e.id)}
                                className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-quantum-700 hover:bg-gray-300 dark:hover:bg-quantum-600 text-xs transition-colors"
                                title={e.name}
                              >
                                {e.type === 'human' ? '👤' : '🤖'} {e.name.split(' ')[0]}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {sortedMatrices.length > 5 && (
            <button
              onClick={() => setShowAllMatrix(!showAllMatrix)}
              className="w-full mt-4 text-center text-quantum-500 hover:text-quantum-400 text-sm font-medium transition-colors"
            >
              {showAllMatrix ? '← Show less' : `Show ${sortedMatrices.length - 5} more entanglements →`}
            </button>
          )}
        </div>
      )}

      {/* Zoku List */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Zoku ({zoku.length})</h2>
          {canWrite && !showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="btn btn-primary text-sm"
            >
              + Add Zoku
            </button>
          )}
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold mb-3">New Zoku</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={newZokuName}
                  onChange={(e) => setNewZokuName(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded"
                  placeholder="Person or agent name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={newZokuType}
                  onChange={(e) => setNewZokuType(e.target.value as 'human' | 'agent')}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded"
                >
                  <option value="human">Human</option>
                  <option value="agent">Agent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email (optional)</label>
                <input
                  type="email"
                  value={newZokuEmail}
                  onChange={(e) => setNewZokuEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded"
                  placeholder="email@example.com"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!newZokuName.trim()) {
                      addNotification('error', 'Name is required')
                      return
                    }
                    setSaving(true)
                    try {
                      await api.createZoku({
                        name: newZokuName,
                        type: newZokuType,
                        email: newZokuEmail || undefined
                      })
                      addNotification('success', 'Zoku created')
                      setShowAddForm(false)
                      setNewZokuName('')
                      setNewZokuEmail('')
                      window.location.reload()
                    } catch (error) {
                      addNotification('error', 'Failed to create zoku')
                    } finally {
                      setSaving(false)
                    }
                  }}
                  disabled={saving}
                  className="px-4 py-2 bg-quantum-600 hover:bg-quantum-700 text-white rounded disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create'}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false)
                    setNewZokuName('')
                    setNewZokuEmail('')
                  }}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {zoku.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No zoku partners yet</div>
        ) : (
          <div className="space-y-2">
            {zoku.map(entity => (
              <button
                key={entity.id}
                onClick={() => onSelectZoku(entity.id)}
                className="w-full text-left p-4 bg-gray-100 dark:bg-quantum-700/50 hover:bg-gray-200 dark:hover:bg-quantum-700 rounded-lg border border-gray-300 dark:border-quantum-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {entity.type === 'human' ? '👤' : '🤖'}
                      </span>
                      <div>
                        <h3 className="font-semibold text-lg">{entity.name}</h3>
                        <p className="text-xs text-gray-500">
                          {entity.type === 'human' ? 'Human' : 'AI Agent'} • Created {formatDate(entity.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
