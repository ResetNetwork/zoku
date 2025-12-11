import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import QuptItem from './QuptItem'
import type { Qupt } from '../lib/types'

interface ActivityListProps {
  onBack: () => void
}

export default function ActivityList({ onBack }: ActivityListProps) {
  const { data: volitions = [] } = useQuery({
    queryKey: ['volitions'],
    queryFn: () => api.listVolitions({ limit: 100 })
  })

  const { data: allQupts = [], isLoading } = useQuery({
    queryKey: ['all-qupts', volitions.map(v => v.id).join(',')],
    queryFn: async () => {
      if (volitions.length === 0) return []
      const qupts: Qupt[] = []
      for (const vol of volitions) {
        const volQupts = await api.listQupts(vol.id, { limit: 50, detailed: true })
        qupts.push(...volQupts)
      }
      return qupts.sort((a, b) => b.created_at - a.created_at)
    },
    enabled: volitions.length > 0
  })

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <h1 className="text-3xl font-bold text-quantum-400 mb-2">Activity</h1>
        <p className="text-gray-400">All activity across volitions</p>
      </div>

      {/* Activity Stream */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">
          All Activity ({allQupts.length})
        </h2>
        {isLoading ? (
          <div className="text-gray-400 text-center py-8">Loading activity...</div>
        ) : allQupts.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No activity yet</div>
        ) : (
          <div className="space-y-3">
            {allQupts.map(qupt => (
              <QuptItem
                key={qupt.id}
                qupt={qupt}
                formatRelativeTime={formatRelativeTime}
                formatDate={formatDate}
                getSourceColor={getSourceColor}
                showVolitionName={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
