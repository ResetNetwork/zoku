import { useState } from 'react'
import Dashboard from './components/Dashboard'
import VolitionDetail from './components/VolitionDetail'
import { useTheme } from './lib/theme'

export default function App() {
  const [selectedVolitionId, setSelectedVolitionId] = useState<string | null>(null)
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen bg-white dark:bg-quantum-900 text-gray-900 dark:text-gray-100 transition-colors">
      <header className="bg-gray-100 dark:bg-quantum-800 border-b border-gray-200 dark:border-quantum-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-quantum-500 dark:text-quantum-400">Zoku</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Project Tracking System</p>
            </div>
            <div className="flex items-center gap-4">
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
