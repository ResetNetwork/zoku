import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Qupt } from '../lib/types'
import QuptItem from './QuptItem'
import EntanglementCard from './EntanglementCard'

interface DashboardProps {
  onSelectEntanglement: (id: string) => void
  onShowEntanglementsList?: () => void
  onShowZokuList?: () => void
  onShowActivityList?: () => void
  onShowSourcesList?: () => void
  onShowJewelsList?: () => void
}

export default function Dashboard({
  onSelectEntanglement,
  onShowEntanglementsList,
  onShowZokuList,
  onShowActivityList,
  onShowSourcesList,
  onShowJewelsList
}: DashboardProps) {
  const { data: entanglements = [], isLoading: entanglementsLoading } = useQuery({
    queryKey: ['entanglements'],
    queryFn: () => api.listEntanglements({ root_only: true, limit: 50 })
  })

  const { data: zoku = [] } = useQuery({
    queryKey: ['zoku'],
    queryFn: () => api.listZoku()
  })

  const { data: jewels = [] } = useQuery({
    queryKey: ['jewels'],
    queryFn: () => api.listJewels()
  })

  const { data: recentQupts = [], isLoading: quptsLoading } = useQuery({
    queryKey: ['recent-qupts', entanglements.map(v => v.id).join(',')],
    queryFn: async () => {
      if (entanglements.length === 0) return []
      const allQupts: Qupt[] = []
      for (const vol of entanglements) {
        const qupts = await api.listQupts(vol.id, { limit: 10, detailed: true })
        allQupts.push(...qupts)
      }
      return allQupts.sort((a, b) => b.created_at - a.created_at).slice(0, 10)
    },
    enabled: entanglements.length > 0
  })

  // Sort entanglements by most recent activity or creation
  const sortedEntanglements = [...entanglements].sort((a, b) => {
    // Prioritize by most recent qupt activity, then by creation date
    const aActivity = a.updated_at || a.created_at
    const bActivity = b.updated_at || b.created_at
    return bActivity - aActivity
  })


  if (entanglementsLoading) {
    return <div className="text-center text-gray-400 py-12">Loading...</div>
  }

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <button
          onClick={onShowEntanglementsList}
          className="card hover:bg-gray-200 dark:hover:bg-quantum-700/70 transition-colors cursor-pointer text-left"
        >
          <div className="text-sm text-gray-400 mb-1">Active Entanglements</div>
          <div className="text-3xl font-bold text-quantum-400">{entanglements.length}</div>
        </button>
        <button
          onClick={onShowZokuList}
          className="card hover:bg-gray-200 dark:hover:bg-quantum-700/70 transition-colors cursor-pointer text-left"
        >
          <div className="text-sm text-gray-400 mb-1">Total Zoku</div>
          <div className="text-3xl font-bold text-quantum-400">{zoku.length}</div>
        </button>
        <button
          onClick={onShowJewelsList}
          className="card hover:bg-gray-200 dark:hover:bg-quantum-700/70 transition-colors cursor-pointer text-left"
        >
          <div className="text-sm text-gray-400 mb-1">Jewels</div>
          <div className="text-3xl font-bold text-quantum-400">{jewels.length}</div>
        </button>
        <button
          onClick={onShowActivityList}
          className="card hover:bg-gray-200 dark:hover:bg-quantum-700/70 transition-colors cursor-pointer text-left"
        >
          <div className="text-sm text-gray-400 mb-1">Recent Qupts</div>
          <div className="text-3xl font-bold text-quantum-400">{recentQupts.length}</div>
        </button>
        <button
          onClick={onShowSourcesList}
          className="card hover:bg-gray-200 dark:hover:bg-quantum-700/70 transition-colors cursor-pointer text-left"
        >
          <div className="text-sm text-gray-400 mb-1">Sources Active</div>
          <div className="text-3xl font-bold text-quantum-400">
            {entanglements.reduce((acc, v) => acc + (v.sources_count || 0), 0)}
          </div>
        </button>
      </div>

      {/* Entanglements List */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Entanglements</h2>
        <div className="space-y-2">
          {sortedEntanglements.slice(0, 5).map(vol => (
            <EntanglementCard
              key={vol.id}
              entanglement={vol}
              onClick={onSelectEntanglement}
            />
          ))}
        </div>
        {entanglements.length > 5 && (
          <button
            onClick={onShowEntanglementsList}
            className="w-full mt-4 text-center text-quantum-500 hover:text-quantum-400 text-sm font-medium transition-colors"
          >
            View all {entanglements.length} entanglements →
          </button>
        )}
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Qupts</h2>
        {quptsLoading ? (
          <div className="text-gray-400 text-center py-8">Loading activity...</div>
        ) : recentQupts.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No activity yet</div>
        ) : (
          <>
            <div className="space-y-3">
              {recentQupts.map(qupt => (
                <QuptItem
                  key={qupt.id}
                  qupt={qupt}
                  showVolitionName={true}
                />
              ))}
            </div>
            <button
              onClick={onShowActivityList}
              className="w-full mt-4 text-center text-quantum-500 hover:text-quantum-400 text-sm font-medium transition-colors"
            >
              View all qupts →
            </button>
          </>
        )}
      </div>
    </div>
  )
}
