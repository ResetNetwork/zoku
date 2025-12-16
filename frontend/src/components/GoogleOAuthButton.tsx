import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useNotifications } from '../lib/notifications'

interface GoogleOAuthButtonProps {
  onSuccess: (jewel: { id: string; name: string }) => void
  onCancel?: () => void
  jewelType?: 'gdrive' | 'gmail'
  initialValues?: {
    name?: string
    clientId?: string
    clientSecret?: string
  }
}

export default function GoogleOAuthButton({ onSuccess, onCancel, jewelType = 'gdrive', initialValues }: GoogleOAuthButtonProps) {
  const [name, setName] = useState(initialValues?.name || '')
  const [authorizing, setAuthorizing] = useState(false)
  const [popup, setPopup] = useState<Window | null>(null)
  const [messageHandler, setMessageHandler] = useState<((event: MessageEvent) => void) | null>(null)
  const { addNotification } = useNotifications()

  // Fetch OAuth application for Google
  const { data: oauthApp, isLoading: loadingOAuthApp } = useQuery({
    queryKey: ['oauth-app', 'google'],
    queryFn: async () => {
      const response = await fetch('/api/oauth-apps?provider=google')
      if (!response.ok) {
        throw new Error('Failed to load OAuth application')
      }
      const data = await response.json()
      return data.oauth_applications?.[0] || null
    }
  })

  const cleanup = () => {
    if (popup && !popup.closed) {
      popup.close()
      setPopup(null)
    }
    if (messageHandler) {
      window.removeEventListener('message', messageHandler)
      setMessageHandler(null)
    }
    setAuthorizing(false)
  }

  const handleStartOAuth = async () => {
    if (!name) {
      addNotification('error', 'Please provide a jewel name')
      return
    }

    if (!oauthApp) {
      addNotification('error', 'No Google OAuth application configured. Ask admin to configure in Settings.')
      return
    }

    setAuthorizing(true)
    console.log('🔐 Starting Google OAuth flow...')

    try {
      // Get authorization URL from backend using OAuth app credentials
      const authData = await fetch('/api/oauth/google/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          client_id: oauthApp.client_id,
          client_secret: '[USE_SERVER_CONFIG]', // Signal to use server-side OAuth app
          jewel_type: jewelType // Send jewel type to filter scopes
        })
      }).then(r => r.json())

      if (authData.error) {
        throw new Error(authData.error.message)
      }

      console.log('📱 Opening OAuth popup...')

      // Open popup window
      const newPopup = window.open(
        authData.authorization_url,
        'google-oauth',
        'width=600,height=700,left=100,top=100'
      )

      if (!newPopup) {
        throw new Error('Popup blocked. Please allow popups for this site.')
      }

      setPopup(newPopup)

      // Listen for postMessage from callback page
      const handleMessage = async (event: MessageEvent) => {
        // Verify origin for security - allow localhost for dev
        const isLocalhost = event.origin.includes('localhost') || event.origin.includes('127.0.0.1')
        const isSameOrigin = event.origin === window.location.origin

        if (!isLocalhost && !isSameOrigin) {
          console.warn('Rejected postMessage from untrusted origin:', event.origin)
          return
        }

        console.log('Received postMessage from:', event.origin)

        if (event.data.type === 'google-oauth-callback') {
          console.log('🎫 Received tokens from OAuth callback')
          console.log('Tokens received:', {
            has_refresh_token: !!event.data.tokens.refresh_token,
            has_access_token: !!event.data.tokens.access_token,
            has_client_id: !!event.data.tokens.client_id,
            has_client_secret: !!event.data.tokens.client_secret
          })

          try {
            const tokens = event.data.tokens

            if (tokens.error) {
              throw new Error(`OAuth failed: ${tokens.error}`)
            }

            if (!tokens.refresh_token) {
              throw new Error('No refresh token received. User may need to re-authorize.')
            }

            if (!tokens.client_id || !tokens.client_secret) {
              throw new Error('Missing client_id or client_secret from callback')
            }

            console.log('🎫 Creating jewel with tokens...')
            console.log('Jewel data:', { name, type: jewelType, oauth_app_id: oauthApp.id })

            // Create jewel with the tokens + link to OAuth application
            const jewel = await api.createJewel({
              name: name,
              type: jewelType,
              oauth_app_id: oauthApp.id,
              data: {
                refresh_token: tokens.refresh_token
              }
            })

            console.log(`✅ Jewel created: ${jewel.id}`)
            const successMsg = jewelType === 'gmail' ? 'Gmail connected successfully' : 'Google Drive connected successfully'
            addNotification('success', successMsg)
            cleanup()
            onSuccess(jewel)

          } catch (error) {
            console.error('❌ Failed to create jewel:', error)
            addNotification('error', error instanceof Error ? error.message : 'Failed to create jewel')
            cleanup()
          }
        }
      }

      console.log('👂 Listening for postMessage events...')
      window.addEventListener('message', handleMessage)
      setMessageHandler(() => handleMessage)

      // Also check if popup closes without completing
      const checkClosed = setInterval(() => {
        try {
          if (newPopup && newPopup.closed) {
            clearInterval(checkClosed)
            cleanup()
            console.log('❌ OAuth popup closed without completing')
          }
        } catch (e) {
          // Ignore Cross-Origin-Opener-Policy errors when checking popup.closed
        }
      }, 500)

    } catch (error) {
      console.error('❌ OAuth initialization failed:', error)
      addNotification('error', error instanceof Error ? error.message : 'Failed to start OAuth')
      setAuthorizing(false)
    }
  }

  const serviceLabel = jewelType === 'gmail' ? 'Gmail' : 'Google Drive'
  const placeholderName = jewelType === 'gmail' ? 'My Gmail' : 'My Google Drive'

  if (loadingOAuthApp) {
    return (
      <div className="card space-y-4">
        <p className="text-gray-400">Loading OAuth configuration...</p>
      </div>
    )
  }

  if (!oauthApp) {
    return (
      <div className="card space-y-4">
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-4">
          <h3 className="text-lg font-semibold text-yellow-500 mb-2">OAuth Application Not Configured</h3>
          <p className="text-sm text-gray-400 mb-3">
            Google OAuth must be configured by an admin before you can connect {serviceLabel}.
          </p>
          <p className="text-sm text-gray-400">
            Ask a prime tier user to configure Google OAuth in <strong>Settings → OAuth Applications</strong>.
          </p>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="btn btn-secondary w-full">
            Cancel
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="card space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Connect {serviceLabel}</h3>
        <p className="text-sm text-gray-400 mb-2">
          Click below to authorize your Google account.
        </p>
        <div className="text-xs text-gray-500 bg-gray-100 dark:bg-quantum-800 rounded p-3">
          <p className="font-medium mb-1">Using configured OAuth application:</p>
          <p className="text-quantum-400">{oauthApp.name}</p>
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-2">Jewel Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholderName}
          className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleStartOAuth}
          disabled={authorizing || !name}
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex-1 flex items-center justify-center gap-2"
        >
          {authorizing ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Authorizing...
            </>
          ) : (
            'Authorize with Google'
          )}
        </button>
        <button
          onClick={() => {
            setAuthorizing(false)
            onCancel?.()
          }}
          className="btn btn-secondary"
          disabled={authorizing}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
