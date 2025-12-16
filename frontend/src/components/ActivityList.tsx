import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import QuptItem from './QuptItem'
import type { Qupt } from '../lib/types'

export default function ActivityList() {
  const [selectedEntanglement, setSelectedEntanglement] = useState<string>('all')
  const [selectedSource, setSelectedSource] = useState<string>('all')
  const queryClient = useQueryClient()

  const { data: entanglements = [] } = useQuery({
    queryKey: ['entanglements'],
    queryFn: () => api.listEntanglements({ limit: 100 })
  })

  const { data: allQupts = [], isLoading } = useQuery({
    queryKey: ['all-qupts', entanglements.map(v => v.id).join(',')],
    queryFn: async () => {
      if (entanglements.length === 0) return []
      const qupts: Qupt[] = []
      for (const vol of entanglements) {
        const volQupts = await api.listQupts(vol.id, { limit: 50, detailed: true })
        qupts.push(...volQupts)
      }
      return qupts.sort((a, b) => b.created_at - a.created_at)
    },
    enabled: entanglements.length > 0
  })

  const handleQuptDeleted = () => {
    queryClient.invalidateQueries({ queryKey: ['all-qupts'] })
  }


  // Get unique source types from qupts
  const uniqueSources = Array.from(new Set(allQupts.map(q => q.source)))

  // Apply filters
  const filteredQupts = allQupts.filter(qupt => {
    const matchesVolition = selectedEntanglement === 'all' || qupt.entanglement_id === selectedEntanglement
    const matchesSource = selectedSource === 'all' || qupt.source === selectedSource
    return matchesVolition && matchesSource
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <h1 className="text-3xl font-bold text-quantum-400 mb-2">Qupts</h1>
        <p className="text-gray-400">Activity across all entanglements</p>
      </div>

      {/* Filters */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-3">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Entanglement</label>
            <select
              value={selectedEntanglement}
              onChange={(e) => setSelectedEntanglement(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Entanglements</option>
              {entanglements.map(v => (
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
          Qupts ({filteredQupts.length})
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
                showEntanglementName={true}
                onDelete={handleQuptDeleted}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
