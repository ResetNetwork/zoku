import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Dashboard from './components/Dashboard'
import VolitionDetail from './components/VolitionDetail'
import { useTheme } from './lib/theme'
import { api } from './lib/api'

export default function App() {
  const [selectedVolitionId, setSelectedVolitionId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const queryClient = useQueryClient()

  const { data: volitions = [] } = useQuery({
    queryKey: ['volitions'],
    queryFn: () => api.listVolitions({ root_only: true, limit: 50 })
  })

  const handleSyncAll = async () => {
    setSyncing(true)
    try {
      const allSources = await Promise.all(
        volitions.map(v => api.listSources(v.id))
      )
      const sources = allSources.flat()
      await Promise.all(sources.map(s => api.syncSource(s.id)))

      queryClient.invalidateQueries({ queryKey: ['qupts'] })
      queryClient.invalidateQueries({ queryKey: ['recent-qupts'] })
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      queryClient.invalidateQueries({ queryKey: ['volitions'] })
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-quantum-900 text-gray-900 dark:text-gray-100 transition-colors">
      <header className="bg-gray-100 dark:bg-quantum-800 border-b border-gray-200 dark:border-quantum-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-quantum-500 dark:text-quantum-400">Zoku</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Project Tracking System</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncAll}
                disabled={syncing || volitions.length === 0}
                className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-quantum-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Sync all sources"
              >
                {syncing ? (
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
              </button>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-quantum-700 transition-colors"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
              {selectedVolitionId && (
                <button
                  onClick={() => setSelectedVolitionId(null)}
                  className="btn btn-secondary"
                >
                  ← Back to Dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {selectedVolitionId ? (
          <VolitionDetail
            volitionId={selectedVolitionId}
            onBack={() => setSelectedVolitionId(null)}
          />
        ) : (
          <Dashboard onSelectVolition={setSelectedVolitionId} />
        )}
      </main>
    </div>
  )
}
