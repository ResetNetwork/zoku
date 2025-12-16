import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNotifications } from '../lib/notifications'
import { useIsPrime } from '../lib/auth'

interface OAuthApplication {
  id: string
  name: string
  provider: string
  client_id: string
  client_secret: string // Will be '[ENCRYPTED]' from API
  scopes: string[]
  created_at: number
  updated_at: number
}

export default function SettingsPage() {
  const isPrime = useIsPrime()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingApp, setEditingApp] = useState<OAuthApplication | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    provider: 'google',
    client_id: '',
    client_secret: '',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/documents.readonly'
    ]
  })
  const [saving, setSaving] = useState(false)
  const { addNotification } = useNotifications()
  const queryClient = useQueryClient()

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ['oauth-apps'],
    queryFn: async () => {
      const response = await fetch('/api/oauth-apps')
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to load OAuth applications')
      }
      const data = await response.json()
      return data.oauth_applications || []
    },
    enabled: isPrime
  })

  const handleCreateApp = async () => {
    if (!formData.name || !formData.client_id || !formData.client_secret) {
      addNotification('error', 'Please provide name, client ID, and client secret')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/oauth-apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create OAuth application')
      }

      addNotification('success', 'OAuth application created')
      queryClient.invalidateQueries({ queryKey: ['oauth-apps'] })
      setShowAddForm(false)
      setFormData({
        name: '',
        provider: 'google',
        client_id: '',
        client_secret: '',
        scopes: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/documents.readonly'
        ]
      })
    } catch (error) {
      console.error('Failed to create OAuth app:', error)
      addNotification('error', error instanceof Error ? error.message : 'Failed to create OAuth application')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateApp = async () => {
    if (!editingApp) return

    setSaving(true)
    try {
      const updates: any = { name: formData.name }
      
      // Only include client_id and client_secret if they were changed
      if (formData.client_id && formData.client_id !== editingApp.client_id) {
        updates.client_id = formData.client_id
      }
      if (formData.client_secret && formData.client_secret !== '[ENCRYPTED]') {
        updates.client_secret = formData.client_secret
      }

      const response = await fetch(`/api/oauth-apps/${editingApp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to update OAuth application')
      }

      addNotification('success', 'OAuth application updated')
      queryClient.invalidateQueries({ queryKey: ['oauth-apps'] })
      setEditingApp(null)
      setFormData({
        name: '',
        provider: 'google',
        client_id: '',
        client_secret: '',
        scopes: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/documents.readonly'
        ]
      })
    } catch (error) {
      console.error('Failed to update OAuth app:', error)
      addNotification('error', error instanceof Error ? error.message : 'Failed to update OAuth application')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteApp = async (id: string, name: string) => {
    if (!confirm(`Delete OAuth application "${name}"? Any jewels using this will stop working.`)) {
      return
    }

    try {
      const response = await fetch(`/api/oauth-apps/${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to delete OAuth application')
      }

      addNotification('success', 'OAuth application deleted')
      queryClient.invalidateQueries({ queryKey: ['oauth-apps'] })
    } catch (error) {
      console.error('Failed to delete OAuth app:', error)
      addNotification('error', error instanceof Error ? error.message : 'Failed to delete OAuth application')
    }
  }

  const startEdit = (app: OAuthApplication) => {
    setEditingApp(app)
    setFormData({
      name: app.name,
      provider: app.provider,
      client_id: app.client_id,
      client_secret: '', // Don't pre-fill encrypted secret
      scopes: app.scopes
    })
    setShowAddForm(false)
  }

  if (!isPrime) {
    return (
      <div className="card">
        <h1 className="text-3xl font-bold text-quantum-400 mb-2">Settings</h1>
        <p className="text-gray-400">Access denied. This page is only available to prime tier users.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <h1 className="text-3xl font-bold text-quantum-400 mb-2">Settings</h1>
        <p className="text-gray-400">Configure OAuth applications for the instance</p>
      </div>

      {/* OAuth Applications Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">OAuth Applications</h2>
            <p className="text-sm text-gray-400">
              Configure OAuth credentials once. Users can then connect their accounts without entering credentials.
            </p>
          </div>
          {!showAddForm && !editingApp && (
            <button
              onClick={() => setShowAddForm(true)}
              className="btn btn-primary"
            >
              Add OAuth App
            </button>
          )}
        </div>

        {isLoading && <p className="text-gray-400">Loading OAuth applications...</p>}

        {!isLoading && apps.length === 0 && !showAddForm && !editingApp && (
          <div className="text-center py-8 text-gray-400">
            <p className="mb-4">No OAuth applications configured yet.</p>
            <p className="text-sm">Add one to enable simplified OAuth flows for your users.</p>
          </div>
        )}

        {/* Add/Edit Form */}
        {(showAddForm || editingApp) && (
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-quantum-800 rounded-lg mb-6">
            <h3 className="text-lg font-semibold">
              {editingApp ? 'Edit OAuth Application' : 'Add OAuth Application'}
            </h3>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Zoku Google OAuth"
                className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Provider</label>
              <select
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                disabled={!!editingApp}
                className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100 disabled:opacity-50"
              >
                <option value="google">Google</option>
                <option value="microsoft" disabled>Microsoft (coming soon)</option>
                <option value="slack" disabled>Slack (coming soon)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Client ID</label>
              <input
                type="text"
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                placeholder="123456789.apps.googleusercontent.com"
                className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
              />
              <p className="text-xs text-gray-500 mt-1">
                Get from{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-quantum-500 hover:text-quantum-400"
                >
                  Google Cloud Console →
                </a>
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Client Secret {editingApp && '(leave blank to keep existing)'}
              </label>
              <input
                type="password"
                value={formData.client_secret}
                onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                placeholder={editingApp ? 'Enter new secret to update' : 'GOCSPX-...'}
                className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Scopes (for Google)</label>
              <div className="space-y-2">
                {[
                  { label: 'Gmail (readonly)', value: 'https://www.googleapis.com/auth/gmail.readonly' },
                  { label: 'Google Drive (readonly)', value: 'https://www.googleapis.com/auth/drive.readonly' },
                  { label: 'Google Docs (readonly)', value: 'https://www.googleapis.com/auth/documents.readonly' }
                ].map(scope => (
                  <label key={scope.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.scopes.includes(scope.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, scopes: [...formData.scopes, scope.value] })
                        } else {
                          setFormData({ ...formData, scopes: formData.scopes.filter(s => s !== scope.value) })
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{scope.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={editingApp ? handleUpdateApp : handleCreateApp}
                disabled={saving}
                className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : editingApp ? 'Update OAuth App' : 'Create OAuth App'}
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false)
                  setEditingApp(null)
                  setFormData({
                    name: '',
                    provider: 'google',
                    client_id: '',
                    client_secret: '',
                    scopes: [
                      'https://www.googleapis.com/auth/gmail.readonly',
                      'https://www.googleapis.com/auth/drive.readonly',
                      'https://www.googleapis.com/auth/documents.readonly'
                    ]
                  })
                }}
                disabled={saving}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* OAuth Apps List */}
        {!isLoading && apps.length > 0 && (
          <div className="space-y-4">
            {apps.map((app: OAuthApplication) => (
              <div key={app.id} className="p-4 bg-gray-50 dark:bg-quantum-800 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{app.name}</h3>
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-300">
                        {app.provider}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 space-y-1">
                      <div>
                        <span className="font-medium">Client ID:</span>{' '}
                        <code className="text-xs bg-gray-200 dark:bg-quantum-700 px-2 py-1 rounded">
                          {app.client_id}
                        </code>
                      </div>
                      <div>
                        <span className="font-medium">Scopes:</span>{' '}
                        {app.scopes.length} scope(s)
                      </div>
                      <div className="text-xs text-gray-500">
                        Created {new Date(app.created_at * 1000).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(app)}
                      className="btn btn-secondary text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteApp(app.id, app.name)}
                      className="btn btn-secondary text-sm text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
