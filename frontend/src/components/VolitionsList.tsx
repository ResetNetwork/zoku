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
              <VolitionCard
                key={vol.id}
                volition={vol}
                onClick={onSelectVolition}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
