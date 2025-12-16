import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useCanWrite } from '../lib/auth'
import { useNotifications } from '../lib/notifications'
import { formatDate, getSourceColor } from '../lib/formatting'
import QuptItem from './QuptItem'
import AddSourceForm from './AddSourceForm'
import EditSourceForm from './EditSourceForm'
import AttributeEditor from './AttributeEditor'

interface EntanglementDetailProps {
  entanglementId: string
}

export default function EntanglementDetail({ entanglementId }: EntanglementDetailProps) {
  const canWrite = useCanWrite()
  const [showAddSource, setShowAddSource] = useState(false)
  const [showAddQupt, setShowAddQupt] = useState(false)
  const [newQuptContent, setNewQuptContent] = useState('')
  const [editingSource, setEditingSource] = useState<any>(null)
  const [savingQupt, setSavingQupt] = useState(false)
  const [quptSourceFilter, setQuptSourceFilter] = useState<string>('all')
  const [quptDateFilter, setQuptDateFilter] = useState<string>('all')
  const [quptsToShow, setQuptsToShow] = useState(20)
  const queryClient = useQueryClient()
  const { addNotification } = useNotifications()

  const { data: entanglement, isLoading } = useQuery({
    queryKey: ['entanglement', entanglementId],
    queryFn: () => api.getEntanglement(entanglementId, false)
  })

  const { data: matrix } = useQuery({
    queryKey: ['matrix', entanglementId],
    queryFn: () => api.getZokuMatrix(entanglementId)
  })

  const { data: qupts = [], isLoading: quptsLoading } = useQuery({
    queryKey: ['qupts', entanglementId],
    queryFn: () => api.listQupts(entanglementId, { limit: 1000, detailed: true })
  })

  // Filter qupts
  const filteredQupts = qupts.filter(qupt => {
    // Source filter
    if (quptSourceFilter !== 'all' && qupt.source !== quptSourceFilter) {
      return false
    }

    // Date filter
    if (quptDateFilter !== 'all') {
      const now = Math.floor(Date.now() / 1000)
      const dayInSeconds = 86400
      const quptAge = now - qupt.created_at

      if (quptDateFilter === '24h' && quptAge > dayInSeconds) return false
      if (quptDateFilter === '7d' && quptAge > dayInSeconds * 7) return false
      if (quptDateFilter === '30d' && quptAge > dayInSeconds * 30) return false
    }

    return true
  })

  // Pagination
  const visibleQupts = filteredQupts.slice(0, quptsToShow)
  const hasMore = filteredQupts.length > quptsToShow

  // Get unique sources for filter dropdown
  const uniqueSources = Array.from(new Set(qupts.map(q => q.source)))

  const { data: sources = [] } = useQuery({
    queryKey: ['sources', entanglementId],
    queryFn: () => api.listSources(entanglementId)
  })

  const formatRelativeTime = (timestamp: number) => {
    const seconds = Math.floor(Date.now() / 1000 - timestamp)
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  if (isLoading) {
    return <div className="text-center text-gray-400 py-12">Loading...</div>
  }

  if (!entanglement) {
    return <div className="text-center text-gray-400 py-12">Entanglement not found</div>
  }

  const pasciRoles = [
    { key: 'perform', label: 'Perform', color: 'text-purple-400' },
    { key: 'accountable', label: 'Accountable', color: 'text-blue-400' },
    { key: 'control', label: 'Control', color: 'text-red-400' },
    { key: 'support', label: 'Support', color: 'text-yellow-400' },
    { key: 'informed', label: 'Informed', color: 'text-green-400' }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <h1 className="text-3xl font-bold text-quantum-400 mb-2">{entanglement.name}</h1>
        {entanglement.description && (
          <p className="text-gray-400">{entanglement.description}</p>
        )}
        <div className="flex gap-6 mt-4 text-sm text-gray-500">
          <div>Created {formatDate(entanglement.created_at)}</div>
          <div>•</div>
          <div>{entanglement.zoku_count || 0} zoku</div>
          <div>•</div>
          <div>{entanglement.qupts_count || 0} qupts</div>
          <div>•</div>
          <div>{entanglement.sources_count || 0} sources</div>
        </div>
      </div>

      {/* Categories/Attributes */}
      <AttributeEditor entanglementId={entanglementId} />

      {/* PASCI Matrix */}
      {matrix && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Responsibilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {pasciRoles.map(({ key, label, color }) => {
              const entities = matrix[key as keyof typeof matrix] || []
              return (
                <div key={key} className="bg-gray-100 dark:bg-quantum-700/30 rounded-lg p-3 border border-gray-300 dark:border-quantum-600">
                  <div className={`text-sm font-semibold mb-2 ${color}`}>
                    {label}
                  </div>
                  {entities.length === 0 ? (
                    <div className="text-xs text-gray-600">None assigned</div>
                  ) : (
                    <div className="space-y-1">
                      {entities.map(entity => (
                        <div key={entity.id} className="text-sm text-gray-300">
                          {entity.name}
                          <span className="text-xs text-gray-600 ml-1">({entity.type})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Sources */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Sources</h2>
          {!showAddSource && (
            <button
              onClick={() => setShowAddSource(true)}
              className="btn btn-primary text-sm"
            >
              + Add Source
            </button>
          )}
        </div>

        {showAddSource && (
          <div className="mb-4">
            <AddSourceForm
              entanglementId={entanglementId}
              onSuccess={() => {
                setShowAddSource(false)
                queryClient.invalidateQueries({ queryKey: ['sources', entanglementId] })
              }}
              onCancel={() => setShowAddSource(false)}
            />
          </div>
        )}

        {editingSource && (
          <div className="mb-4">
            <EditSourceForm
              source={editingSource}
              onSuccess={() => {
                setEditingSource(null)
                queryClient.invalidateQueries({ queryKey: ['sources', entanglementId] })
              }}
              onCancel={() => setEditingSource(null)}
            />
          </div>
        )}

        {sources.length === 0 ? (
          <div className="text-gray-400 text-center py-4">No sources configured</div>
        ) : (
          <div className="space-y-2">
            {sources.map(source => {
              const config = typeof source.config === 'string' ? JSON.parse(source.config) : source.config
              return (
                <div key={source.id} className="p-3 bg-gray-100 dark:bg-quantum-700/30 rounded-lg border border-gray-300 dark:border-quantum-600">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getSourceColor(source.type)}`}>
                          {source.type}
                        </span>
                        {config.owner && config.repo && (
                          <span className="text-sm text-gray-700 dark:text-gray-300">{config.owner}/{config.repo}</span>
                        )}
                        {config.tag && (
                          <span className="text-sm text-gray-600 dark:text-gray-400">tag: {config.tag}</span>
                        )}
                        {config.document_id && source.credential?.email && (
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {source.credential.email}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-500 mt-1">
                        {source.last_error ? (
                          <span className="text-red-400">Error: {source.last_error}</span>
                        ) : source.last_sync ? (
                          source.last_sync < Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60)
                            ? 'Queued for initial sync'
                            : `Last checked: ${formatRelativeTime(source.last_sync)}`
                        ) : (
                          'Not yet checked'
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingSource(source)
                          setShowAddSource(false)
                        }}
                        className="p-1 rounded-md hover:bg-quantum-500/20 text-quantum-400 hover:text-quantum-300 transition-colors"
                        title="Edit source"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete this ${source.type} source?`)) return
                          try {
                            await fetch(`/api/sources/${source.id}`, { method: 'DELETE' })
                            addNotification('success', 'Source deleted')
                            queryClient.invalidateQueries({ queryKey: ['sources', entanglementId] })
                          } catch (error) {
                            addNotification('error', 'Failed to delete source')
                          }
                        }}
                        className="p-1 rounded-md hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                        title="Delete source"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <div
                        className={`w-2 h-2 rounded-full ${
                          source.last_error
                            ? 'bg-red-500'
                            : source.enabled
                            ? 'bg-green-500'
                            : 'bg-gray-600'
                        }`}
                        title={source.last_error || (source.enabled ? 'Active' : 'Disabled')}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Activity Feed */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Qupts ({visibleQupts.length})</h2>
          {canWrite && !showAddQupt && (
            <button
              onClick={() => setShowAddQupt(true)}
              className="btn btn-primary text-sm"
            >
              + Add Qupt
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Source</label>
            <select
              value={quptSourceFilter}
              onChange={(e) => {
                setQuptSourceFilter(e.target.value)
                setQuptsToShow(20) // Reset pagination
              }}
              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm"
            >
              <option value="all">All Sources</option>
              {uniqueSources.map(source => (
                <option key={source} value={source}>
                  {source.charAt(0).toUpperCase() + source.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date Range</label>
            <select
              value={quptDateFilter}
              onChange={(e) => {
                setQuptDateFilter(e.target.value)
                setQuptsToShow(20) // Reset pagination
              }}
              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm"
            >
              <option value="all">All Time</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
          {(quptSourceFilter !== 'all' || quptDateFilter !== 'all') && (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setQuptSourceFilter('all')
                  setQuptDateFilter('all')
                  setQuptsToShow(20)
                }}
                className="px-3 py-2 text-sm text-quantum-500 hover:text-quantum-400"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Add Qupt Form */}
        {showAddQupt && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold mb-3">New Qupt</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Content *</label>
                <textarea
                  value={newQuptContent}
                  onChange={(e) => setNewQuptContent(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded"
                  rows={3}
                  placeholder="Describe the activity or update..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!newQuptContent.trim()) {
                      addNotification('error', 'Content is required')
                      return
                    }
                    setSavingQupt(true)
                    try {
                      await api.createQupt({
                        entanglement_id: entanglementId,
                        content: newQuptContent,
                        source: 'manual'
                      })
                      addNotification('success', 'Qupt created')
                      setShowAddQupt(false)
                      setNewQuptContent('')
                      queryClient.invalidateQueries({ queryKey: ['qupts', entanglementId] })
                      queryClient.invalidateQueries({ queryKey: ['all-qupts'] })
                    } catch (error) {
                      addNotification('error', 'Failed to create qupt')
                    } finally {
                      setSavingQupt(false)
                    }
                  }}
                  disabled={savingQupt}
                  className="px-4 py-2 bg-quantum-600 hover:bg-quantum-700 text-white rounded disabled:opacity-50"
                >
                  {savingQupt ? 'Creating...' : 'Create'}
                </button>
                <button
                  onClick={() => {
                    setShowAddQupt(false)
                    setNewQuptContent('')
                  }}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {quptsLoading ? (
          <div className="text-gray-400 text-center py-8">Loading activity...</div>
        ) : filteredQupts.length === 0 ? (
          <div className="text-gray-400 text-center py-8">
            {qupts.length === 0 ? 'No activity yet' : 'No qupts match the current filters'}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {visibleQupts.map(qupt => (
                <QuptItem
                  key={qupt.id}
                  qupt={qupt}
                />
              ))}
            </div>
            
            {hasMore && (
              <div className="text-center mt-4">
                <button
                  onClick={() => setQuptsToShow(prev => prev + 20)}
                  className="px-6 py-2 bg-quantum-600 hover:bg-quantum-700 text-white rounded"
                >
                  Show More ({filteredQupts.length - quptsToShow} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
