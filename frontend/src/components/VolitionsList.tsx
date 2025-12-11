import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

interface VolitionsListProps {
  onSelectVolition: (id: string) => void
}

export default function VolitionsList({ onSelectVolition }: VolitionsListProps) {
  const { data: volitions = [], isLoading } = useQuery({
    queryKey: ['all-volitions'],
    queryFn: () => api.listVolitions({ limit: 100 })
  })

  // Sort by most recent activity or creation
  const sortedVolitions = [...volitions].sort((a, b) => {
    const aActivity = a.updated_at || a.created_at
    const bActivity = b.updated_at || b.created_at
    return bActivity - aActivity
  })

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  if (isLoading) {
    return <div className="text-center text-gray-400 py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <h1 className="text-3xl font-bold text-quantum-400 mb-2">All Volitions</h1>
        <p className="text-gray-400">Projects and initiatives</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Total Volitions</div>
          <div className="text-3xl font-bold text-quantum-400">{volitions.length}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Root Level</div>
          <div className="text-3xl font-bold text-quantum-400">
            {volitions.filter(v => !v.parent_id).length}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Nested</div>
          <div className="text-3xl font-bold text-quantum-400">
            {volitions.filter(v => v.parent_id).length}
          </div>
        </div>
      </div>

      {/* Volitions List */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">All Volitions</h2>
        {volitions.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No volitions yet</div>
        ) : (
          <div className="space-y-2">
            {sortedVolitions.map(vol => (
              <button
                key={vol.id}
                onClick={() => onSelectVolition(vol.id)}
                className="w-full text-left p-4 bg-gray-100 dark:bg-quantum-700/50 hover:bg-gray-200 dark:hover:bg-quantum-700 rounded-lg border border-gray-300 dark:border-quantum-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{vol.name}</h3>
                    {vol.description && (
                      <p className="text-sm text-gray-400 mt-1">{vol.description}</p>
                    )}
                    {vol.parent_id && (
                      <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400 text-xs">
                        Nested
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <div className="text-center">
                      <div className="text-quantum-400 font-semibold">{vol.entangled_count || 0}</div>
                      <div className="text-xs">entangled</div>
                    </div>
                    <div className="text-center">
                      <div className="text-quantum-400 font-semibold">{vol.qupts_count || 0}</div>
                      <div className="text-xs">qupts</div>
                    </div>
                    <div className="text-center">
                      <div className="text-quantum-400 font-semibold">{vol.sources_count || 0}</div>
                      <div className="text-xs">sources</div>
                    </div>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
