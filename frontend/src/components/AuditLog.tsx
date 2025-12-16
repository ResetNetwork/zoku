// Audit Log Viewer - Prime only
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useIsPrime } from '../lib/auth'

interface AuditLogEntry {
  id: string
  timestamp: number
  zoku_id: string | null
  action: string
  resource_type: string
  resource_id: string
  details: string | null
  ip_address: string | null
  user_agent: string | null
  request_id: string | null
}

export default function AuditLog() {
  const isPrime = useIsPrime()
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [limit, setLimit] = useState(100)

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', limit],
    queryFn: async () => {
      const response = await fetch(`/api/audit-logs?limit=${limit}`)
      const data = await response.json()
      return data.logs || []
    },
    enabled: isPrime
  })

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  const getActionColor = (action: string) => {
    if (action.includes('create')) return 'bg-green-500/20 text-green-300'
    if (action.includes('update')) return 'bg-blue-500/20 text-blue-300'
    if (action.includes('delete')) return 'bg-red-500/20 text-red-300'
    if (action.includes('promote') || action.includes('demote')) return 'bg-yellow-500/20 text-yellow-300'
    return 'bg-gray-500/20 text-gray-300'
  }

  if (!isPrime) {
    return (
      <div className="card">
        <h1 className="text-3xl font-bold text-quantum-400 mb-2">Admin: Audit Log</h1>
        <p className="text-red-400">You need Prime access to view this page</p>
      </div>
    )
  }

  // Apply filters
  const uniqueResourceTypes = Array.from(new Set(logs.map((l: AuditLogEntry) => l.resource_type))) as string[]
  const uniqueActions = Array.from(new Set(logs.map((l: AuditLogEntry) => l.action))) as string[]
  
  const filteredLogs = logs.filter((log: AuditLogEntry) => {
    const matchesResourceType = resourceTypeFilter === 'all' || log.resource_type === resourceTypeFilter
    const matchesAction = actionFilter === 'all' || log.action === actionFilter
    return matchesResourceType && matchesAction
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <h1 className="text-3xl font-bold text-quantum-400 mb-2">Admin: Audit Log</h1>
        <p className="text-gray-400">Track all sensitive operations and changes</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Total Events</div>
          <div className="text-3xl font-bold text-quantum-400">{logs.length}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Filtered</div>
          <div className="text-3xl font-bold text-quantum-400">{filteredLogs.length}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Resource Types</div>
          <div className="text-3xl font-bold text-quantum-400">{uniqueResourceTypes.length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-3">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Resource Type</label>
            <select
              value={resourceTypeFilter}
              onChange={(e) => setResourceTypeFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Types</option>
              {uniqueResourceTypes.map((type: string) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Action</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Actions</option>
              {uniqueActions.map((action: string) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Limit</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
            >
              <option value={50}>Last 50</option>
              <option value={100}>Last 100</option>
              <option value={500}>Last 500</option>
              <option value={1000}>Last 1000</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Event Log ({filteredLogs.length})</h2>
        {isLoading ? (
          <div className="text-center text-gray-400 py-8">Loading...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center text-gray-400 py-8">No audit logs found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300 dark:border-gray-700">
                  <th className="text-left py-3 px-2 text-xs font-semibold text-gray-600 dark:text-gray-400">Timestamp</th>
                  <th className="text-left py-3 px-2 text-xs font-semibold text-gray-600 dark:text-gray-400">User</th>
                  <th className="text-left py-3 px-2 text-xs font-semibold text-gray-600 dark:text-gray-400">Action</th>
                  <th className="text-left py-3 px-2 text-xs font-semibold text-gray-600 dark:text-gray-400">Resource</th>
                  <th className="text-left py-3 px-2 text-xs font-semibold text-gray-600 dark:text-gray-400">Details</th>
                  <th className="text-left py-3 px-2 text-xs font-semibold text-gray-600 dark:text-gray-400">Request ID</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log: AuditLogEntry) => (
                  <tr key={log.id} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-quantum-700/30">
                    <td className="py-3 px-2 text-xs text-gray-600 dark:text-gray-400">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="py-3 px-2">
                      <code className="text-xs text-quantum-400">
                        {log.zoku_id || 'system'}
                      </code>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`text-xs px-2 py-1 rounded ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <div className="text-xs">
                        <div className="text-gray-400">{log.resource_type}</div>
                        <code className="text-gray-600 dark:text-gray-500">{log.resource_id}</code>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-xs text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {log.details || '-'}
                    </td>
                    <td className="py-3 px-2">
                      <code className="text-xs text-gray-500">{log.request_id || '-'}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Export Options */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Export</h2>
        <p className="text-sm text-gray-400 mb-4">
          Download audit logs for compliance or analysis
        </p>
        <button
          onClick={() => {
            // Convert to CSV
            const headers = ['Timestamp', 'User ID', 'Action', 'Resource Type', 'Resource ID', 'Details', 'IP Address', 'Request ID']
            const rows = filteredLogs.map((log: AuditLogEntry) => [
              formatDate(log.timestamp),
              log.zoku_id || '',
              log.action,
              log.resource_type,
              log.resource_id,
              log.details || '',
              log.ip_address || '',
              log.request_id || ''
            ])
            
            const csv = [
              headers.join(','),
              ...rows.map((row: string[]) => row.map((cell: string) => `"${cell}"`).join(','))
            ].join('\n')
            
            // Download
            const blob = new Blob([csv], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `audit-log-${Date.now()}.csv`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
          }}
          className="btn btn-secondary"
        >
          Download as CSV
        </button>
      </div>
    </div>
  )
}
