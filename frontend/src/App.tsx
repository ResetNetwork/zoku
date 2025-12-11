import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Dashboard from './components/Dashboard'
import VolitionsList from './components/VolitionsList'
import VolitionDetail from './components/VolitionDetail'
import EntangledList from './components/EntangledList'
import EntangledDetail from './components/EntangledDetail'
import ActivityList from './components/ActivityList'
import SourcesList from './components/SourcesList'
import { useTheme } from './lib/theme'
import { useNotifications } from './lib/notifications'
import { api } from './lib/api'

type View = 'dashboard' | 'volitions' | 'entangled' | 'activity' | 'sources'

export default function App() {
  const [currentView, setCurrentView] = useState<View>(() => {
    const params = new URLSearchParams(window.location.search)
    const view = params.get('view')
    if (view === 'volitions' || view === 'entangled' || view === 'activity' || view === 'sources') {
      return view
    }
    return 'dashboard'
  })
  const [selectedVolitionId, setSelectedVolitionId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('volition')
  })
  const [selectedEntangledId, setSelectedEntangledId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('entangled')
  })
  const [syncing, setSyncing] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { addNotification } = useNotifications()
  const queryClient = useQueryClient()

  // Sync URL with current state
  useEffect(() => {
    const params = new URLSearchParams()
    if (selectedVolitionId) {
      params.set('volition', selectedVolitionId)
    } else if (selectedEntangledId) {
      params.set('entangled', selectedEntangledId)
    } else if (currentView !== 'dashboard') {
      params.set('view', currentView)
    }
    const newUrl = params.toString() ? `?${params}` : window.location.pathname
    window.history.pushState({}, '', newUrl)
  }, [selectedVolitionId, selectedEntangledId, currentView])

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      setSelectedVolitionId(params.get('volition'))
      setSelectedEntangledId(params.get('entangled'))
      const view = params.get('view')
      if (view === 'volitions' || view === 'entangled' || view === 'activity' || view === 'sources') {
        setCurrentView(view)
      } else {
        setCurrentView('dashboard')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const handleSelectVolition = (id: string) => {
    setSelectedVolitionId(id)
    setSelectedEntangledId(null)
    setCurrentView('dashboard')
  }

  const handleSelectEntangled = (id: string) => {
    setSelectedEntangledId(id)
    setSelectedVolitionId(null)
    setCurrentView('entangled')
  }

  const handleBack = () => {
    setSelectedVolitionId(null)
    setSelectedEntangledId(null)
  }

  const handleShowEntangledList = () => {
    setCurrentView('entangled')
    setSelectedVolitionId(null)
    setSelectedEntangledId(null)
  }

  const handleShowDashboard = () => {
    setCurrentView('dashboard')
    setSelectedVolitionId(null)
    setSelectedEntangledId(null)
  }

  const handleShowVolitionsList = () => {
    setCurrentView('volitions')
    setSelectedVolitionId(null)
    setSelectedEntangledId(null)
  }

  const handleShowActivityList = () => {
    setCurrentView('activity')
    setSelectedVolitionId(null)
    setSelectedEntangledId(null)
  }

  const handleShowSourcesList = () => {
    setCurrentView('sources')
    setSelectedVolitionId(null)
    setSelectedEntangledId(null)
  }

  const { data: volitions = [] } = useQuery({
    queryKey: ['volitions'],
    queryFn: () => api.listVolitions({ root_only: true, limit: 50 })
  })

  const handleSyncAll = async () => {
    setSyncing(true)
    console.log('🔄 Starting sync for all sources...')

    try {
      const allSources = await Promise.all(
        volitions.map(v => api.listSources(v.id))
      )
      const sources = allSources.flat()
      console.log(`📊 Found ${sources.length} source(s) to sync`)

      const results = await Promise.all(sources.map(s => api.syncSource(s.id)))
      const totalQupts = results.reduce((sum, r) => sum + (r.qupts_collected || 0), 0)

      console.log(`✅ Sync complete: ${totalQupts} new qupt(s) collected`)

      // Invalidate all queries to refresh data
      queryClient.invalidateQueries()

      // Show notification
      if (totalQupts > 0) {
        addNotification('success', `Collected ${totalQupts} new activity item${totalQupts === 1 ? '' : 's'}`)
      } else {
        addNotification('info', 'Sync complete - no new activity')
      }
    } catch (error) {
      console.error('❌ Sync failed:', error)
      addNotification('error', 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-quantum-900 text-gray-900 dark:text-gray-100 transition-colors">
      <header className="bg-gray-100 dark:bg-quantum-800 border-b border-gray-200 dark:border-quantum-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button onClick={handleShowDashboard} className="text-left hover:opacity-80 transition-opacity">
              <h1 className="text-2xl font-bold text-quantum-500 dark:text-quantum-400">Zoku</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Project Tracking System</p>
            </button>
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
              {(selectedVolitionId || selectedEntangledId) && (
                <button
                  onClick={handleBack}
                  className="btn btn-secondary"
                >
                  ← Back
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
            onBack={handleBack}
          />
        ) : selectedEntangledId ? (
          <EntangledDetail
            entangledId={selectedEntangledId}
            onBack={handleBack}
            onSelectVolition={handleSelectVolition}
          />
        ) : currentView === 'volitions' ? (
          <VolitionsList onSelectVolition={handleSelectVolition} />
        ) : currentView === 'entangled' ? (
          <EntangledList onSelectEntangled={handleSelectEntangled} />
        ) : currentView === 'activity' ? (
          <ActivityList onBack={handleShowDashboard} />
        ) : currentView === 'sources' ? (
          <SourcesList onBack={handleShowDashboard} />
        ) : (
          <Dashboard
            onSelectVolition={handleSelectVolition}
            onShowVolitionsList={handleShowVolitionsList}
            onShowEntangledList={handleShowEntangledList}
            onShowActivityList={handleShowActivityList}
            onShowSourcesList={handleShowSourcesList}
          />
        )}
      </main>
    </div>
  )
}
