import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Volition, Qupt } from '../lib/types'
import QuptItem from './QuptItem'
import VolitionCard from './VolitionCard'

interface DashboardProps {
  onSelectVolition: (id: string) => void
  onShowVolitionsList?: () => void
  onShowEntangledList?: () => void
  onShowActivityList?: () => void
  onShowSourcesList?: () => void
  onShowCredentialsList?: () => void
}

export default function Dashboard({
  onSelectVolition,
  onShowVolitionsList,
  onShowEntangledList,
  onShowActivityList,
  onShowSourcesList,
  onShowCredentialsList
}: DashboardProps) {
  const { data: volitions = [], isLoading: volitionsLoading } = useQuery({
    queryKey: ['volitions'],
    queryFn: () => api.listVolitions({ root_only: true, limit: 50 })
  })

  const { data: entangled = [] } = useQuery({
    queryKey: ['entangled'],
    queryFn: () => api.listEntangled()
  })

  const { data: credentials = [] } = useQuery({
    queryKey: ['credentials'],
    queryFn: () => api.listCredentials()
  })

  const { data: recentQupts = [], isLoading: quptsLoading } = useQuery({
    queryKey: ['recent-qupts', volitions.map(v => v.id).join(',')],
    queryFn: async () => {
      if (volitions.length === 0) return []
      const allQupts: Qupt[] = []
      for (const vol of volitions) {
        const qupts = await api.listQupts(vol.id, { limit: 10, detailed: true })
        allQupts.push(...qupts)
      }
      return allQupts.sort((a, b) => b.created_at - a.created_at).slice(0, 10)
    },
    enabled: volitions.length > 0
  })

  // Sort volitions by most recent activity or creation
  const sortedVolitions = [...volitions].sort((a, b) => {
    // Prioritize by most recent qupt activity, then by creation date
    const aActivity = a.updated_at || a.created_at
    const bActivity = b.updated_at || b.created_at
    return bActivity - aActivity
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

  if (volitionsLoading) {
    return <div className="text-center text-gray-400 py-12">Loading...</div>
  }

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <button
          onClick={onShowVolitionsList}
          className="card hover:bg-gray-200 dark:hover:bg-quantum-700/70 transition-colors cursor-pointer text-left"
        >
          <div className="text-sm text-gray-400 mb-1">Active Volitions</div>
          <div className="text-3xl font-bold text-quantum-400">{volitions.length}</div>
        </button>
        <button
          onClick={onShowEntangledList}
          className="card hover:bg-gray-200 dark:hover:bg-quantum-700/70 transition-colors cursor-pointer text-left"
        >
          <div className="text-sm text-gray-400 mb-1">Total Entangled</div>
          <div className="text-3xl font-bold text-quantum-400">{entangled.length}</div>
        </button>
        <button
          onClick={onShowCredentialsList}
          className="card hover:bg-gray-200 dark:hover:bg-quantum-700/70 transition-colors cursor-pointer text-left"
        >
          <div className="text-sm text-gray-400 mb-1">Credentials</div>
          <div className="text-3xl font-bold text-quantum-400">{credentials.length}</div>
        </button>
        <button
          onClick={onShowActivityList}
          className="card hover:bg-gray-200 dark:hover:bg-quantum-700/70 transition-colors cursor-pointer text-left"
        >
          <div className="text-sm text-gray-400 mb-1">Recent Activity</div>
          <div className="text-3xl font-bold text-quantum-400">{recentQupts.length}</div>
        </button>
        <button
          onClick={onShowSourcesList}
          className="card hover:bg-gray-200 dark:hover:bg-quantum-700/70 transition-colors cursor-pointer text-left"
        >
          <div className="text-sm text-gray-400 mb-1">Sources Active</div>
          <div className="text-3xl font-bold text-quantum-400">
            {volitions.reduce((acc, v) => acc + (v.sources_count || 0), 0)}
          </div>
        </button>
      </div>

      {/* Volitions List */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Volitions</h2>
        <div className="space-y-2">
          {sortedVolitions.slice(0, 5).map(vol => (
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
        {volitions.length > 5 && (
          <button
            onClick={onShowVolitionsList}
            className="w-full mt-4 text-center text-quantum-500 hover:text-quantum-400 text-sm font-medium transition-colors"
          >
            View all {volitions.length} volitions →
          </button>
        )}
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Activity</h2>
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
                  formatRelativeTime={formatRelativeTime}
                  formatDate={formatDate}
                  getSourceColor={getSourceColor}
                  showVolitionName={true}
                />
              ))}
            </div>
            <button
              onClick={onShowActivityList}
              className="w-full mt-4 text-center text-quantum-500 hover:text-quantum-400 text-sm font-medium transition-colors"
            >
              View all activity →
            </button>
          </>
        )}
      </div>
    </div>
  )
}
