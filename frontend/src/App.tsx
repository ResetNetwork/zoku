import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Dashboard from './components/Dashboard'
import EntanglementsList from './components/EntanglementsList'
import EntanglementDetail from './components/EntanglementDetail'
import ZokuList from './components/ZokuList'
import ZokuDetail from './components/ZokuDetail'
import ActivityList from './components/ActivityList'
import SourcesList from './components/SourcesList'
import JewelsList from './components/JewelsList'
import AccountPage from './components/AccountPage'
import AdminUsers from './components/AdminUsers'
import AuditLog from './components/AuditLog'
import { useTheme } from './lib/theme'
import { useNotifications } from './lib/notifications'
import { useAuth } from './lib/auth'
import { api } from './lib/api'

type View = 'dashboard' | 'entanglements' | 'zoku' | 'qupts' | 'sources' | 'jewels' | 'account' | 'admin-users' | 'audit-log'

export default function App() {
  const { user, loading, error } = useAuth()

  // Show loading state while checking authentication (EARLY RETURN - no queries run yet)
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-quantum-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-quantum-400 border-r-transparent mb-4"></div>
          <p className="text-gray-400">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // Show 401 error page if authentication failed (EARLY RETURN - no queries run)
  if (error || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-quantum-900">
        <div className="max-w-md w-full mx-4">
          <div className="bg-quantum-800 border border-red-500/30 rounded-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-red-500 mb-2">401 Unauthorized</h1>
            <p className="text-gray-400 mb-6">
              {error || 'Authentication required. Please log in to continue.'}
            </p>
            <div className="text-sm text-gray-500 bg-quantum-900/50 rounded p-4">
              <p className="font-mono">
                {error?.includes('Failed to fetch') 
                  ? 'Unable to connect to authentication server. Please check your network connection.'
                  : 'You need valid credentials to access this application.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // User is authenticated - proceed with app rendering
  return <AuthenticatedApp user={user} />
}

// Separate component for authenticated app (all hooks run only when authenticated)
function AuthenticatedApp({ user }: { user: any }) {
  // const isPrime = useIsPrime()  // For future nav menu implementation
  const [currentView, setCurrentView] = useState<View>(() => {
    const params = new URLSearchParams(window.location.search)
    const view = params.get('view') as View | null
    const validViews: View[] = ['entanglements', 'zoku', 'qupts', 'sources', 'jewels', 'account', 'admin-users', 'audit-log']
    if (view && validViews.includes(view)) {
      return view
    }
    return 'dashboard'
  })
  const [selectedEntanglementId, setSelectedEntanglementId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('entanglement')
  })
  const [selectedZokuId, setSelectedEntangledId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('zoku')
  })
  const [syncing, setSyncing] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { addNotification } = useNotifications()
  const queryClient = useQueryClient()

  // Sync URL with current state
  useEffect(() => {
    const params = new URLSearchParams()
    if (selectedEntanglementId) {
      params.set('entanglement', selectedEntanglementId)
    } else if (selectedZokuId) {
      params.set('zoku', selectedZokuId)
    } else if (currentView !== 'dashboard') {
      params.set('view', currentView)
    }
    const newUrl = params.toString() ? `?${params}` : window.location.pathname
    window.history.pushState({}, '', newUrl)
  }, [selectedEntanglementId, selectedZokuId, currentView])

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      setSelectedEntanglementId(params.get('entanglement'))
      setSelectedEntangledId(params.get('zoku'))
      const view = params.get('view') as View | null
      const validViews: View[] = ['entanglements', 'zoku', 'qupts', 'sources', 'jewels', 'account', 'admin-users', 'audit-log']
      if (view && validViews.includes(view)) {
        setCurrentView(view)
      } else {
        setCurrentView('dashboard')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const handleSelectEntanglement = (id: string) => {
    setSelectedEntanglementId(id)
    setSelectedEntangledId(null)
    setCurrentView('dashboard')
  }

  const handleSelectZoku = (id: string) => {
    setSelectedEntangledId(id)
    setSelectedEntanglementId(null)
    setCurrentView('zoku')
  }

  const handleBack = () => {
    setSelectedEntanglementId(null)
    setSelectedEntangledId(null)
  }

  const handleShowZokuList = () => {
    setCurrentView('zoku')
    setSelectedEntanglementId(null)
    setSelectedEntangledId(null)
  }

  const handleShowDashboard = () => {
    setCurrentView('dashboard')
    setSelectedEntanglementId(null)
    setSelectedEntangledId(null)
  }

  const handleShowEntanglementsList = () => {
    setCurrentView('entanglements')
    setSelectedEntanglementId(null)
    setSelectedEntangledId(null)
  }

  const handleShowActivityList = () => {
    setCurrentView('qupts')
    setSelectedEntanglementId(null)
    setSelectedEntangledId(null)
  }

  const handleShowSourcesList = () => {
    setCurrentView('sources')
    setSelectedEntanglementId(null)
    setSelectedEntangledId(null)
  }

  const handleShowJewelsList = () => {
    setCurrentView('jewels')
    setSelectedEntanglementId(null)
    setSelectedEntangledId(null)
  }

  const handleShowAccount = () => {
    setCurrentView('account')
    setSelectedEntanglementId(null)
    setSelectedEntangledId(null)
  }

  const { data: volitions = [] } = useQuery({
    queryKey: ['entanglements'],
    queryFn: () => api.listEntanglements({ root_only: true, limit: 50 })
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
      const successCount = results.filter(r => r.success !== false).length
      const errorCount = sources.length - successCount

      console.log(`✅ Sync complete: ${totalQupts} item(s) processed, ${successCount} succeeded, ${errorCount} failed`)

      // Invalidate all queries to refresh data
      queryClient.invalidateQueries()

      // Build informative notification message
      let message = `Synced ${sources.length} source${sources.length === 1 ? '' : 's'}`

      if (errorCount > 0) {
        message += ` (${errorCount} failed)`
        addNotification('error', message)
      } else if (totalQupts > 0) {
        message += ` - checked for updates`
        addNotification('success', message)
      } else {
        message += ` - no new activity`
        addNotification('info', message)
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
              <h1 className="text-2xl font-bold text-quantum-500 dark:text-quantum-400">The Great Game</h1>
            </button>
            <div className="flex items-center gap-3">
              {/* User Menu */}
              {user && (
                <button
                  onClick={handleShowAccount}
                  className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-200 dark:hover:bg-quantum-700 transition-colors"
                  title="Account settings"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300">{user.name}</span>
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    user.access_tier === 'prime' ? 'bg-yellow-500' :
                    user.access_tier === 'entangled' ? 'bg-purple-500' :
                    user.access_tier === 'coherent' ? 'bg-blue-500' : 'bg-gray-500'
                  }`} title={user.access_tier} />
                </button>
              )}

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
              {(selectedEntanglementId || selectedZokuId) && (
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
        {selectedEntanglementId ? (
          <EntanglementDetail
            entanglementId={selectedEntanglementId}
          />
        ) : selectedZokuId ? (
          <ZokuDetail
            zokuId={selectedZokuId}
            onSelectEntanglement={handleSelectEntanglement}
          />
        ) : currentView === 'entanglements' ? (
          <EntanglementsList onSelectEntanglement={handleSelectEntanglement} />
        ) : currentView === 'zoku' ? (
          <ZokuList
            onSelectZoku={handleSelectZoku}
            onSelectEntanglement={handleSelectEntanglement}
          />
        ) : currentView === 'qupts' ? (
          <ActivityList />
        ) : currentView === 'sources' ? (
          <SourcesList />
        ) : currentView === 'jewels' ? (
          <JewelsList />
        ) : currentView === 'account' ? (
          <AccountPage />
        ) : currentView === 'admin-users' ? (
          <AdminUsers />
        ) : currentView === 'audit-log' ? (
          <AuditLog />
        ) : (
          <Dashboard
            onSelectEntanglement={handleSelectEntanglement}
            onShowEntanglementsList={handleShowEntanglementsList}
            onShowZokuList={handleShowZokuList}
            onShowActivityList={handleShowActivityList}
            onShowSourcesList={handleShowSourcesList}
            onShowJewelsList={handleShowJewelsList}
          />
        )}
      </main>
    </div>
  )
}
