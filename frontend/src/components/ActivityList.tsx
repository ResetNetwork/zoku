import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import QuptItem from './QuptItem'
import type { Qupt } from '../lib/types'

interface ActivityListProps {
  onBack: () => void
}

export default function ActivityList({ onBack }: ActivityListProps) {
  const [selectedVolition, setSelectedVolition] = useState<string>('all')
  const [selectedSource, setSelectedSource] = useState<string>('all')

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
      gdrive: 'bg-green-500/20 text-green-300',
      mcp: 'bg-gray-500/20 text-gray-300'
    }
    return colors[source] || 'bg-gray-500/20 text-gray-300'
  }

  // Get unique source types from qupts
  const uniqueSources = Array.from(new Set(allQupts.map(q => q.source)))

  // Apply filters
  const filteredQupts = allQupts.filter(qupt => {
    const matchesVolition = selectedVolition === 'all' || qupt.volition_id === selectedVolition
    const matchesSource = selectedSource === 'all' || qupt.source === selectedSource
    return matchesVolition && matchesSource
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <h1 className="text-3xl font-bold text-quantum-400 mb-2">Activity</h1>
        <p className="text-gray-400">All activity across volitions</p>
      </div>

      {/* Filters */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-3">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Volition</label>
            <select
              value={selectedVolition}
              onChange={(e) => setSelectedVolition(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Volitions</option>
              {volitions.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Source Type</label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Sources</option>
              {uniqueSources.map(source => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Activity Stream */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">
          Activity ({filteredQupts.length})
        </h2>
        {isLoading ? (
          <div className="text-gray-400 text-center py-8">Loading activity...</div>
        ) : filteredQupts.length === 0 ? (
          <div className="text-gray-400 text-center py-8">
            {allQupts.length === 0 ? 'No activity yet' : 'No activity matches filters'}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQupts.map(qupt => (
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
