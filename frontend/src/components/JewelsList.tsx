import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useNotifications } from '../lib/notifications'
import { useIsPrime, useAuth } from '../lib/auth'
import GoogleOAuthButton from './GoogleOAuthButton'

export default function JewelsList() {
  const isPrime = useIsPrime()
  const { user } = useAuth()
  const [showAddForm, setShowAddForm] = useState<'github' | 'zammad' | 'gdrive' | 'gmail' | null>(null)
  const [editingJewel, setEditingJewel] = useState<any>(null)
  const [formData, setFormData] = useState<any>({ name: '', token: '', url: '' })
  const [saving, setSaving] = useState(false)
  const { addNotification } = useNotifications()
  const queryClient = useQueryClient()

  const { data: jewels = [], isLoading } = useQuery({
    queryKey: ['jewels'],
    queryFn: () => api.listJewels()
  })

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      github: 'GitHub',
      zammad: 'Zammad',
      gdocs: 'Google Drive',
      gmail: 'Gmail'
    }
    return labels[type] || type
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      github: 'bg-purple-500/20 text-purple-300',
      zammad: 'bg-blue-500/20 text-blue-300',
      gdocs: 'bg-green-500/20 text-green-300',
      gmail: 'bg-red-500/20 text-red-300'
    }
    return colors[type] || 'bg-gray-500/20 text-gray-300'
  }

  const handleAddJewel = async () => {
    if (!formData.name || !formData.token) {
      addNotification('error', 'Please provide a name and token')
      return
    }

    if (showAddForm === 'zammad' && !(formData as any).url) {
      addNotification('error', 'Please provide Zammad URL')
      return
    }

    setSaving(true)
    try {
      const jewelData = showAddForm === 'zammad'
        ? { token: formData.token, url: (formData as any).url }
        : { token: formData.token };

      const jewel = await api.createJewel({
        name: formData.name,
        type: showAddForm!,
        data: jewelData
      })

      console.log(`✅ Jewel created: ${jewel.id}`)
      addNotification('success', `${getTypeLabel(showAddForm!)} jewel added`)
      queryClient.invalidateQueries({ queryKey: ['jewels'] })
      setShowAddForm(null)
      setFormData({ name: '', token: '', url: '' } as any)
    } catch (error) {
      console.error('Failed to create jewel:', error)
      addNotification('error', error instanceof Error ? error.message : 'Failed to create jewel')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteJewel = async (id: string, name: string) => {
    if (!confirm(`Delete jewel "${name}"? This will break any sources using it.`)) {
      return
    }

    try {
      await api.deleteJewel(id)
      addNotification('success', 'Jewel deleted')
      queryClient.invalidateQueries({ queryKey: ['jewels'] })
    } catch (error) {
      console.error('Failed to delete jewel:', error)
      addNotification('error', error instanceof Error ? error.message : 'Failed to delete jewel')
    }
  }

  const handleGoogleOAuthSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['jewels'] })
    setShowAddForm(null)
    setEditingJewel(null)
  }

  const handleUpdateJewel = async () => {
    if (!editingJewel || !formData.name) {
      addNotification('error', 'Please provide a name')
      return
    }

    if (editingJewel.type === 'zammad' && !(formData as any).url) {
      addNotification('error', 'Please provide Zammad URL')
      return
    }

    setSaving(true)
    try {
      const updateData: any = { name: formData.name };

      // Only update token/data if provided
      if (formData.token) {
        if (editingJewel.type === 'zammad') {
          updateData.data = { token: formData.token, url: (formData as any).url };
        } else {
          updateData.data = { token: formData.token };
        }
      } else if (editingJewel.type === 'zammad' && (formData as any).url) {
        // URL changed but token didn't - still need to update with URL
        updateData.data = { url: (formData as any).url };
      }

      await api.updateJewel(editingJewel.id, updateData)

      console.log(`✅ Jewel updated: ${editingJewel.id}`)
      addNotification('success', `${getTypeLabel(editingJewel.type)} jewel updated`)
      queryClient.invalidateQueries({ queryKey: ['jewels'] })
      setEditingJewel(null)
      setFormData({ name: '', token: '' })
    } catch (error) {
      console.error('Failed to update jewel:', error)
      addNotification('error', error instanceof Error ? error.message : 'Failed to update jewel')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (jewel: any) => {
    setEditingJewel(jewel)
    setFormData({
      name: jewel.name,
      token: '',
      url: jewel.validation_metadata?.url || ''
    })
    setShowAddForm(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <h1 className="text-3xl font-bold text-quantum-400 mb-2">Jewels ({jewels.length})</h1>
        <p className="text-gray-400">Manage API tokens and OAuth connections</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Total Jewels</div>
          <div className="text-3xl font-bold text-quantum-400">{jewels.length}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">GitHub</div>
          <div className="text-3xl font-bold text-quantum-400">
            {jewels.filter((c: any) => c.type === 'github').length}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Google Drive</div>
          <div className="text-3xl font-bold text-quantum-400">
            {jewels.filter((c: any) => c.type === 'gdrive').length}
          </div>
        </div>
      </div>

      {/* Add Jewel Buttons */}
      {!showAddForm && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Add Jewel</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowAddForm('github')}
              className="btn btn-secondary flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub Token
            </button>
            <button
              onClick={() => setShowAddForm('zammad')}
              className="btn btn-secondary flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
              Zammad Token
            </button>
            <button
              onClick={() => setShowAddForm('gdrive')}
              className="btn btn-secondary flex items-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google Drive
            </button>
            <button
              onClick={() => setShowAddForm('gmail')}
              className="btn btn-secondary flex items-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
              </svg>
              Gmail
            </button>
          </div>
        </div>
      )}

      {/* Add GitHub/Zammad Token Form */}
      {showAddForm && showAddForm !== 'gdrive' && showAddForm !== 'gmail' && (
        <div className="card space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Add {getTypeLabel(showAddForm)} Jewel</h3>
            <p className="text-sm text-gray-400">
              {showAddForm === 'github' && 'Create a personal access token at github.com/settings/tokens'}
              {showAddForm === 'zammad' && 'Get your API token from Zammad admin settings'}
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={`My ${getTypeLabel(showAddForm)}`}
              className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
            />
          </div>

          {showAddForm === 'zammad' && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">Zammad URL</label>
              <input
                type="text"
                value={(formData as any).url || ''}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://your.zammad.tld"
                className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-2">API Token</label>
            <input
              type="password"
              value={formData.token}
              onChange={(e) => setFormData({ ...formData, token: e.target.value })}
              placeholder={showAddForm === 'github' ? 'ghp_...' : 'your-api-token'}
              className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAddJewel}
              disabled={saving || !formData.name || !formData.token}
              className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex-1"
            >
              {saving ? 'Saving...' : 'Save Jewel'}
            </button>
            <button
              onClick={() => {
                setShowAddForm(null)
                setFormData({ name: '', token: '' })
              }}
              className="btn btn-secondary"
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Google OAuth Form (Add) - for both Google Drive and Gmail */}
      {(showAddForm === 'gdrive' || showAddForm === 'gmail') && !editingJewel && (
        <GoogleOAuthButton
          onSuccess={handleGoogleOAuthSuccess}
          onCancel={() => setShowAddForm(null)}
          jewelType={showAddForm}
        />
      )}

      {/* Google OAuth Re-auth (Edit) - for both Google Drive and Gmail */}
      {editingJewel && (editingJewel.type === 'gdrive' || editingJewel.type === 'gmail') && (
        <div className="card space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Re-authorize {getTypeLabel(editingJewel.type)}</h3>
            <p className="text-sm text-gray-400 mb-4">
              Update the jewel name or re-authorize to refresh the access token
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Jewel Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={async () => {
                // Re-authorize using existing client_id/secret from backend
                setSaving(true)
                try {
                  // Get fresh OAuth URL using existing jewels
                  const response = await fetch(`/api/jewels/${editingJewel.id}/reauthorize`, {
                    method: 'POST'
                  })
                  const data = await response.json()

                  if (data.error) {
                    throw new Error(data.error.message)
                  }

                  // Open OAuth popup
                  const popup = window.open(data.authorization_url, 'google-oauth', 'width=600,height=700')

                  if (!popup) {
                    throw new Error('Popup blocked')
                  }

                  // Listen for callback
                  let checkClosed: ReturnType<typeof setInterval> | null = null

                  const handleMessage = async (event: MessageEvent) => {
                    if (event.data.type === 'google-oauth-callback') {
                      const tokens = event.data.tokens
                      if (tokens.refresh_token) {
                        // Update jewel with new tokens
                        await api.updateJewel(editingJewel.id, {
                          name: formData.name,
                          data: {
                            refresh_token: tokens.refresh_token,
                            client_id: tokens.client_id,
                            client_secret: tokens.client_secret
                          }
                        })
                        addNotification('success', 'Google Drive jewel updated')
                        queryClient.invalidateQueries({ queryKey: ['jewels'] })
                        setEditingJewel(null)
                        setSaving(false)

                        // Cleanup
                        if (checkClosed) clearInterval(checkClosed)
                        window.removeEventListener('message', handleMessage)
                        if (popup && !popup.closed) popup.close()
                      }
                    }
                  }

                  window.addEventListener('message', handleMessage)

                  // Check if popup closes without completing
                  checkClosed = setInterval(() => {
                    if (popup.closed) {
                      if (checkClosed) clearInterval(checkClosed)
                      window.removeEventListener('message', handleMessage)
                      setSaving(false)
                      console.log('❌ OAuth popup closed without completing')
                    }
                  }, 500)

                } catch (error) {
                  console.error('Failed to re-authorize:', error)
                  addNotification('error', error instanceof Error ? error.message : 'Failed to re-authorize')
                  setSaving(false)
                }
              }}
              disabled={saving || !formData.name}
              className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex-1"
            >
              {saving ? 'Authorizing...' : 'Re-authorize with Google'}
            </button>
            <button
              onClick={() => {
                setEditingJewel(null)
                setFormData({ name: '', token: '' })
              }}
              className="btn btn-secondary"
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit GitHub/Zammad Token Form */}
      {editingJewel && editingJewel.type !== 'gdrive' && (
        <div className="card space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Update {getTypeLabel(editingJewel.type)} Jewel</h3>
            <p className="text-sm text-gray-400">Update the jewel name or token</p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={`My ${getTypeLabel(editingJewel.type)}`}
              className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
            />
          </div>

          {editingJewel.type === 'zammad' && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">Zammad URL</label>
              <input
                type="text"
                value={(formData as any).url || ''}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://your.zammad.tld"
                className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-2">API Token (leave blank to keep current)</label>
            <input
              type="password"
              value={formData.token}
              onChange={(e) => setFormData({ ...formData, token: e.target.value })}
              placeholder="Enter new token or leave blank"
              className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleUpdateJewel}
              disabled={saving || !formData.name}
              className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex-1"
            >
              {saving ? 'Saving...' : 'Update Jewel'}
            </button>
            <button
              onClick={() => {
                setEditingJewel(null)
                setFormData({ name: '', token: '' })
              }}
              className="btn btn-secondary"
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Jewels List */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Jewels ({jewels.length})</h2>
        {isLoading ? (
          <div className="text-gray-400 text-center py-8">Loading...</div>
        ) : jewels.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No jewels yet</div>
        ) : (
          <div className="space-y-2">
            {jewels.map((cred: any) => (
              <div
                key={cred.id}
                className="p-4 bg-gray-100 dark:bg-quantum-700/50 rounded-lg border border-gray-300 dark:border-quantum-600"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{cred.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${getTypeColor(cred.type)}`}>
                        {getTypeLabel(cred.type)}
                      </span>
                      {/* Show owner for prime users viewing others' jewels */}
                      {isPrime && cred.owner_id !== user?.id && cred.owner_name && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                          Owner: {cred.owner_name}
                        </span>
                      )}
                    </div>

                    {/* Show account email prominently for Google Drive */}
                    {cred.type === 'gdrive' && cred.validation_metadata?.email && (
                      <div className="text-sm text-quantum-400 font-medium mb-2">
                        {cred.validation_metadata.email}
                      </div>
                    )}

                    {/* Show authenticated_as for GitHub */}
                    {cred.type === 'github' && cred.validation_metadata?.authenticated_as && (
                      <div className="text-sm text-quantum-400 font-medium mb-2">
                        @{cred.validation_metadata.authenticated_as}
                      </div>
                    )}

                    {/* Show Zammad info for Zammad jewels */}
                    {cred.type === 'zammad' && (
                      <div className="text-sm space-y-1 mb-2">
                        {cred.validation_metadata?.email && (
                          <div className="text-quantum-400 font-medium">
                            {cred.validation_metadata.email}
                          </div>
                        )}
                        {cred.validation_metadata?.url && (
                          <div className="text-gray-500 dark:text-gray-400">
                            {cred.validation_metadata.url}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="text-sm text-gray-400 space-y-1">
                      <div>Created: {formatDate(cred.created_at)}</div>
                      {cred.last_validated && (
                        <div>Last validated: {formatDate(cred.last_validated)}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(cred)}
                      className="p-2 rounded-md hover:bg-quantum-500/20 text-quantum-400 hover:text-quantum-300 transition-colors"
                      title="Update jewel"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteJewel(cred.id, cred.name)}
                      className="p-2 rounded-md hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                      title="Delete jewel"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
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
