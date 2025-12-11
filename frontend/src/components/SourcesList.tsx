import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

interface SourcesListProps {
  onBack: () => void
}

export default function SourcesList({ onBack }: SourcesListProps) {
  const { data: volitions = [] } = useQuery({
    queryKey: ['volitions'],
    queryFn: () => api.listVolitions({ limit: 100 })
  })

  const { data: allSources = [], isLoading } = useQuery({
    queryKey: ['all-sources', volitions.map(v => v.id).join(',')],
    queryFn: async () => {
      if (volitions.length === 0) return []
      const sources: any[] = []
      for (const vol of volitions) {
        const volSources = await api.listSources(vol.id)
        sources.push(...volSources.map(s => ({ ...s, volition_name: vol.name, volition_id: vol.id })))
      }
      return sources
    },
    enabled: volitions.length > 0
  })

  const formatDate = (timestamp: number | null | undefined) => {
    if (!timestamp) return 'Never'
    return new Date(timestamp * 1000).toLocaleString()
  }

  const getSourceColor = (type: string) => {
    const colors: Record<string, string> = {
      github: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      zammad: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      gdocs: 'bg-green-500/20 text-green-300 border-green-500/30',
      gmail: 'bg-red-500/20 text-red-300 border-red-500/30',
      gdrive: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
    }
    return colors[type] || 'bg-gray-500/20 text-gray-300 border-gray-500/30'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <h1 className="text-3xl font-bold text-quantum-400 mb-2">Sources</h1>
        <p className="text-gray-400">Activity sources across all volitions</p>
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

      {/* Sources List */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">All Sources</h2>
        {isLoading ? (
          <div className="text-gray-400 text-center py-8">Loading sources...</div>
        ) : allSources.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No sources configured yet</div>
        ) : (
          <div className="space-y-3">
            {allSources.map(source => (
              <div
                key={source.id}
                className={`p-4 rounded-lg border-2 ${getSourceColor(source.type)} ${
                  source.enabled ? '' : 'opacity-50'
                }`}
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
                    {source.config && (
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {source.type === 'github' && source.config.owner && source.config.repo && (
                          <span>{source.config.owner}/{source.config.repo}</span>
                        )}
                        {source.type === 'zammad' && source.config.tag && (
                          <span>Tag: {source.config.tag}</span>
                        )}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-2">
                      Last sync: {formatDate(source.last_sync)}
                    </div>
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
