import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import QuptItem from './QuptItem'

interface VolitionDetailProps {
  volitionId: string
  onBack: () => void
}

export default function VolitionDetail({ volitionId, onBack }: VolitionDetailProps) {
  const queryClient = useQueryClient()
  const [syncingSource, setSyncingSource] = useState<string | null>(null)

  const { data: volition, isLoading } = useQuery({
    queryKey: ['volition', volitionId],
    queryFn: () => api.getVolition(volitionId, false)
  })

  const { data: matrix } = useQuery({
    queryKey: ['matrix', volitionId],
    queryFn: () => api.getMatrix(volitionId)
  })

  const { data: qupts = [], isLoading: quptsLoading } = useQuery({
    queryKey: ['qupts', volitionId],
    queryFn: () => api.listQupts(volitionId, { limit: 50, detailed: true })
  })

  const { data: sources = [] } = useQuery({
    queryKey: ['sources', volitionId],
    queryFn: () => api.listSources(volitionId)
  })

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  const handleSyncSource = async (sourceId: string) => {
    setSyncingSource(sourceId)
    try {
      await api.syncSource(sourceId)
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['qupts', volitionId] })
      queryClient.invalidateQueries({ queryKey: ['sources', volitionId] })
      queryClient.invalidateQueries({ queryKey: ['recent-qupts'] })
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      setSyncingSource(null)
    }
  }

  const formatRelativeTime = (timestamp: number) => {
    const seconds = Math.floor(Date.now() / 1000 - timestamp)
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  const getSourceColor = (source: string) => {
    const colors: Record<string, string> = {
      github: 'bg-purple-500/20 text-purple-300',
      zammad: 'bg-blue-500/20 text-blue-300',
      gdocs: 'bg-green-500/20 text-green-300',
      mcp: 'bg-gray-500/20 text-gray-300'
    }
    return colors[source] || 'bg-gray-500/20 text-gray-300'
  }

  if (isLoading) {
    return <div className="text-center text-gray-400 py-12">Loading...</div>
  }

  if (!volition) {
    return <div className="text-center text-gray-400 py-12">Volition not found</div>
  }

  const pasciRoles = [
    { key: 'perform', label: 'Perform', color: 'text-purple-400' },
    { key: 'accountable', label: 'Accountable', color: 'text-blue-400' },
    { key: 'control', label: 'Control', color: 'text-red-400' },
    { key: 'support', label: 'Support', color: 'text-yellow-400' },
    { key: 'informed', label: 'Informed', color: 'text-green-400' }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <h1 className="text-3xl font-bold text-quantum-400 mb-2">{volition.name}</h1>
        {volition.description && (
          <p className="text-gray-400">{volition.description}</p>
        )}
        <div className="flex gap-6 mt-4 text-sm text-gray-500">
          <div>Created {formatDate(volition.created_at)}</div>
          <div>•</div>
          <div>{volition.qupts_count || 0} qupts</div>
          <div>•</div>
          <div>{volition.sources_count || 0} sources</div>
        </div>
      </div>

      {/* PASCI Matrix */}
      {matrix && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">PASCI Responsibility Matrix</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {pasciRoles.map(({ key, label, color }) => {
              const entities = matrix[key as keyof typeof matrix] || []
              return (
                <div key={key} className="bg-gray-100 dark:bg-quantum-700/30 rounded-lg p-3 border border-gray-300 dark:border-quantum-600">
                  <div className={`text-sm font-semibold mb-2 ${color}`}>
                    {label}
                  </div>
                  {entities.length === 0 ? (
                    <div className="text-xs text-gray-600">None assigned</div>
                  ) : (
                    <div className="space-y-1">
                      {entities.map(entity => (
                        <div key={entity.id} className="text-sm text-gray-300">
                          {entity.name}
                          <span className="text-xs text-gray-600 ml-1">({entity.type})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Sources */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Sources</h2>
        {sources.length === 0 ? (
          <div className="text-gray-400 text-center py-4">No sources configured</div>
        ) : (
          <div className="space-y-2">
            {sources.map(source => {
              const config = typeof source.config === 'string' ? JSON.parse(source.config) : source.config
              return (
                <div key={source.id} className="p-3 bg-gray-100 dark:bg-quantum-700/30 rounded-lg border border-gray-300 dark:border-quantum-600">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getSourceColor(source.type)}`}>
                          {source.type}
                        </span>
                        {config.owner && config.repo && (
                          <span className="text-sm text-gray-700 dark:text-gray-300">{config.owner}/{config.repo}</span>
                        )}
                        {config.tag && (
                          <span className="text-sm text-gray-600 dark:text-gray-400">tag: {config.tag}</span>
                        )}
                      </div>
                      {source.last_sync && (
                        <div className="text-xs text-gray-600 dark:text-gray-500 mt-1">
                          Last sync: {formatRelativeTime(source.last_sync)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSyncSource(source.id)}
                        disabled={syncingSource === source.id}
                        className="px-3 py-1 text-xs bg-quantum-500 hover:bg-quantum-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                      >
                        {syncingSource === source.id ? 'Syncing...' : 'Sync Now'}
                      </button>
                      <div className={`w-2 h-2 rounded-full ${source.enabled ? 'bg-green-500' : 'bg-gray-600'}`} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Activity Feed */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Activity</h2>
        {quptsLoading ? (
          <div className="text-gray-400 text-center py-8">Loading activity...</div>
        ) : qupts.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No activity yet</div>
        ) : (
          <div className="space-y-2">
            {qupts.map(qupt => (
              <QuptItem
                key={qupt.id}
                qupt={qupt}
                formatRelativeTime={formatRelativeTime}
                formatDate={formatDate}
                getSourceColor={getSourceColor}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
