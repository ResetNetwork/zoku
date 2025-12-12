import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useNotifications } from '../lib/notifications'
import EditSourceForm from './EditSourceForm'

export default function SourcesList() {
  const [editingSource, setEditingSource] = useState<any>(null)
  const queryClient = useQueryClient()
  const { addNotification } = useNotifications()
  const { data: entanglements = [] } = useQuery({
    queryKey: ['entanglements'],
    queryFn: () => api.listEntanglements({ limit: 100 })
  })

  const { data: allSources = [], isLoading } = useQuery({
    queryKey: ['all-sources', entanglements.map(v => v.id).join(',')],
    queryFn: async () => {
      if (entanglements.length === 0) return []
      const sources: any[] = []
      for (const vol of entanglements) {
        const volSources = await api.listSources(vol.id)
        sources.push(...volSources.map(s => ({ ...s, volition_name: vol.name, entanglement_id: vol.id })))
      }
      return sources
    },
    enabled: entanglements.length > 0
  })

  const formatDate = (timestamp: number | null | undefined) => {
    if (!timestamp) return 'Never'
    return new Date(timestamp * 1000).toLocaleString()
  }

  const getSourceColor = (type: string) => {
    const colors: Record<string, string> = {
      github: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      zammad: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      gdrive: 'bg-green-500/20 text-green-300 border-green-500/30',
      gmail: 'bg-red-500/20 text-red-300 border-red-500/30'
    }
    return colors[type] || 'bg-gray-500/20 text-gray-300 border-gray-500/30'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <h1 className="text-3xl font-bold text-quantum-400 mb-2">Sources</h1>
        <p className="text-gray-400">Activity sources across all entanglements</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Total Sources</div>
          <div className="text-3xl font-bold text-quantum-400">{allSources.length}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Active</div>
          <div className="text-3xl font-bold text-quantum-400">
            {allSources.filter(s => s.enabled).length}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Disabled</div>
          <div className="text-3xl font-bold text-quantum-400">
            {allSources.filter(s => !s.enabled).length}
          </div>
        </div>
      </div>

      {/* Edit Source Form */}
      {editingSource && (
        <EditSourceForm
          source={editingSource}
          onSuccess={() => {
            setEditingSource(null)
            queryClient.invalidateQueries({ queryKey: ['entanglements'] })
          }}
          onCancel={() => setEditingSource(null)}
        />
      )}

      {/* Sources List */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Sources</h2>
        {isLoading ? (
          <div className="text-gray-400 text-center py-8">Loading sources...</div>
        ) : allSources.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No sources configured yet</div>
        ) : (
          <div className="space-y-3">
            {allSources.map(source => (
              <div
                key={source.id}
                className="p-4 bg-gray-100 dark:bg-quantum-700/30 rounded-lg border border-gray-300 dark:border-quantum-600"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSourceColor(source.type)}`}>
                        {source.type}
                      </span>
                      <span className="text-sm text-quantum-400 font-medium">
                        {source.volition_name}
                      </span>
                      {!source.enabled && (
                        <span className="px-2 py-1 rounded-full bg-gray-500/20 text-gray-400 text-xs">
                          Disabled
                        </span>
                      )}
                    </div>

                    {/* Account details */}
                    {source.credential?.email && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        {source.credential.email}
                      </div>
                    )}

                    {/* Config details */}
                    {source.config && (
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {source.type === 'github' && source.config.owner && source.config.repo && (
                          <span>{source.config.owner}/{source.config.repo}</span>
                        )}
                        {source.type === 'zammad' && source.config.tag && (
                          <span>Tag: {source.config.tag}</span>
                        )}
                        {source.type === 'gdrive' && source.config.document_id && (
                          <span>Doc ID: {source.config.document_id.substring(0, 12)}...</span>
                        )}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-2">
                      Last sync: {formatDate(source.last_sync)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingSource(source)}
                      className="p-1 rounded-md hover:bg-quantum-500/20 text-quantum-400 hover:text-quantum-300 transition-colors"
                      title="Edit source"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete ${source.type} source from ${source.volition_name}?`)) return
                        try {
                          await fetch(`/api/sources/${source.id}`, { method: 'DELETE' })
                          addNotification('success', 'Source deleted')
                          queryClient.invalidateQueries({ queryKey: ['entanglements'] })
                        } catch (error) {
                          addNotification('error', 'Failed to delete source')
                        }
                      }}
                      className="p-1 rounded-md hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                      title="Delete source"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <div className={`w-2 h-2 rounded-full ${source.enabled ? 'bg-green-500' : 'bg-gray-600'}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
