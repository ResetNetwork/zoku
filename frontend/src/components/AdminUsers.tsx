// Admin User Management - Prime only
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth, useIsPrime } from '../lib/auth'
import { useNotifications } from '../lib/notifications'
import type { AccessTier } from '../lib/types'

export default function AdminUsers() {
  const { user } = useAuth()
  const isPrime = useIsPrime()
  const { addNotification } = useNotifications()
  const queryClient = useQueryClient()
  const [changingTier, setChangingTier] = useState<string | null>(null)
  const [newTier, setNewTier] = useState<AccessTier>('observed')

  const { data: allZoku = [], isLoading } = useQuery({
    queryKey: ['all-zoku'],
    queryFn: () => api.listZoku()
  })

  const formatDate = (timestamp: number | null | undefined) => {
    if (!timestamp) return 'Never'
    return new Date(timestamp * 1000).toLocaleString()
  }

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      observed: 'bg-gray-500/20 text-gray-300',
      coherent: 'bg-blue-500/20 text-blue-300',
      entangled: 'bg-purple-500/20 text-purple-300',
      prime: 'bg-yellow-500/20 text-yellow-300'
    }
    return colors[tier] || 'bg-gray-500/20 text-gray-300'
  }

  const getTierLabel = (tier: string) => {
    return tier.charAt(0).toUpperCase() + tier.slice(1)
  }

  const handleChangeTier = async (zokuId: string) => {
    if (!isPrime) {
      addNotification('error', 'Only Prime users can change tiers')
      return
    }

    if (zokuId === user?.id) {
      addNotification('error', 'Cannot change your own tier')
      return
    }

    try {
      await api.updateZokuTier(zokuId, newTier)
      addNotification('success', `User tier updated to ${newTier}`)
      queryClient.invalidateQueries({ queryKey: ['all-zoku'] })
      setChangingTier(null)
    } catch (error) {
      addNotification('error', 'Failed to update tier')
    }
  }

  if (!isPrime) {
    return (
      <div className="card">
        <h1 className="text-3xl font-bold text-quantum-400 mb-2">Admin: Users</h1>
        <p className="text-red-400">You need Prime access to view this page</p>
      </div>
    )
  }

  if (isLoading) {
    return <div className="text-center text-gray-400 py-12">Loading...</div>
  }

  // Sort by tier (prime first) then by name
  const tierOrder: Record<string, number> = { prime: 0, entangled: 1, coherent: 2, observed: 3 }
  const sortedZoku = [...allZoku].sort((a, b) => {
    const tierDiff = tierOrder[a.access_tier || 'observed'] - tierOrder[b.access_tier || 'observed']
    if (tierDiff !== 0) return tierDiff
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <h1 className="text-3xl font-bold text-quantum-400 mb-2">Admin: User Management</h1>
        <p className="text-gray-400">Manage user access tiers and permissions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Prime</div>
          <div className="text-3xl font-bold text-yellow-400">
            {allZoku.filter(z => z.access_tier === 'prime').length}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Entangled</div>
          <div className="text-3xl font-bold text-purple-400">
            {allZoku.filter(z => z.access_tier === 'entangled').length}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Coherent</div>
          <div className="text-3xl font-bold text-blue-400">
            {allZoku.filter(z => z.access_tier === 'coherent').length}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Observed</div>
          <div className="text-3xl font-bold text-gray-400">
            {allZoku.filter(z => z.access_tier === 'observed').length}
          </div>
        </div>
      </div>

      {/* User List */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">All Users ({sortedZoku.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-300 dark:border-gray-700">
                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600 dark:text-gray-400">Name</th>
                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600 dark:text-gray-400">Email</th>
                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600 dark:text-gray-400">Type</th>
                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600 dark:text-gray-400">Tier</th>
                <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600 dark:text-gray-400">Last Login</th>
                <th className="text-right py-3 px-2 text-sm font-semibold text-gray-600 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedZoku.map(zoku => (
                <tr key={zoku.id} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-quantum-700/30">
                  <td className="py-3 px-2">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {zoku.name}
                      {zoku.id === user?.id && (
                        <span className="ml-2 text-xs text-quantum-400">(you)</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-sm text-gray-600 dark:text-gray-400">
                    {zoku.email || '-'}
                  </td>
                  <td className="py-3 px-2">
                    <span className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700">
                      {zoku.type}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    {changingTier === zoku.id ? (
                      <select
                        value={newTier}
                        onChange={(e) => setNewTier(e.target.value as AccessTier)}
                        className="text-sm px-2 py-1 rounded bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600"
                      >
                        <option value="observed">Observed</option>
                        <option value="coherent">Coherent</option>
                        <option value="entangled">Entangled</option>
                        <option value="prime">Prime</option>
                      </select>
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded ${getTierColor(zoku.access_tier || 'observed')}`}>
                        {getTierLabel(zoku.access_tier || 'observed')}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-sm text-gray-600 dark:text-gray-400">
                    {formatDate(zoku.last_login)}
                  </td>
                  <td className="py-3 px-2 text-right">
                    {changingTier === zoku.id ? (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleChangeTier(zoku.id)}
                          className="text-xs px-3 py-1 bg-quantum-600 hover:bg-quantum-700 text-white rounded"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setChangingTier(null)}
                          className="text-xs px-3 py-1 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          if (zoku.id === user?.id) {
                            addNotification('error', 'Cannot change your own tier')
                            return
                          }
                          setChangingTier(zoku.id)
                          setNewTier(zoku.access_tier as AccessTier || 'observed')
                        }}
                        disabled={zoku.id === user?.id}
                        className="text-xs px-3 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Change Tier
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tier Descriptions */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Access Tier Descriptions</h2>
        <div className="space-y-3">
          <div className="flex gap-4">
            <span className={`text-xs px-3 py-1 rounded ${getTierColor('prime')} min-w-[100px] text-center`}>
              Prime
            </span>
            <div className="flex-1 text-sm text-gray-600 dark:text-gray-400">
              Full admin access - manage users, promote/demote tiers, delete any jewels
            </div>
          </div>
          <div className="flex gap-4">
            <span className={`text-xs px-3 py-1 rounded ${getTierColor('entangled')} min-w-[100px] text-center`}>
              Entangled
            </span>
            <div className="flex-1 text-sm text-gray-600 dark:text-gray-400">
              Full CRUD operations - create/edit/delete entanglements, sources, qupts, manage jewels
            </div>
          </div>
          <div className="flex gap-4">
            <span className={`text-xs px-3 py-1 rounded ${getTierColor('coherent')} min-w-[100px] text-center`}>
              Coherent
            </span>
            <div className="flex-1 text-sm text-gray-600 dark:text-gray-400">
              Read-only access + jewel management - view all data, manage own credentials
            </div>
          </div>
          <div className="flex gap-4">
            <span className={`text-xs px-3 py-1 rounded ${getTierColor('observed')} min-w-[100px] text-center`}>
              Observed
            </span>
            <div className="flex-1 text-sm text-gray-600 dark:text-gray-400">
              No access - pre-created for PASCI matrix assignments, awaiting activation
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
