import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import VolitionCard from './VolitionCard'

interface VolitionsListProps {
  onSelectVolition: (id: string) => void
}

export default function VolitionsList({ onSelectVolition }: VolitionsListProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [functionFilter, setFunctionFilter] = useState<string>('all')

  const { data: volitions = [], isLoading } = useQuery({
    queryKey: ['all-volitions'],
    queryFn: () => api.listVolitions({ limit: 100 })
  })

  const { data: dimensions } = useQuery({
    queryKey: ['dimensions'],
    queryFn: () => api.listDimensions()
  })

  // Apply filters
  const filteredVolitions = volitions.filter(vol => {
    if (statusFilter !== 'all' && vol.attributes?.status !== statusFilter) return false
    if (functionFilter !== 'all' && vol.attributes?.function !== functionFilter) return false
    return true
  })

  // Sort by most recent activity or creation
  const sortedVolitions = [...filteredVolitions].sort((a, b) => {
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
          <div className="text-sm text-gray-400 mb-1">Filtered</div>
          <div className="text-3xl font-bold text-quantum-400">{sortedVolitions.length}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Root Level</div>
          <div className="text-3xl font-bold text-quantum-400">
            {volitions.filter(v => !v.parent_id).length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-3">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Statuses</option>
              {dimensions?.dimensions?.find((d: any) => d.name === 'status')?.values?.map((v: any) => (
                <option key={v.value} value={v.label}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Function</label>
            <select
              value={functionFilter}
              onChange={(e) => setFunctionFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Functions</option>
              {dimensions?.dimensions?.find((d: any) => d.name === 'function')?.values?.map((v: any) => (
                <option key={v.value} value={v.label}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Volitions List */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">All Volitions ({sortedVolitions.length})</h2>
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
