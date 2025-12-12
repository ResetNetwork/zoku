import { useState } from 'react'
import { api } from '../lib/api'
import { useNotifications } from '../lib/notifications'

interface GoogleOAuthButtonProps {
  onSuccess: (jewel: { id: string; name: string }) => void
  onCancel?: () => void
  initialValues?: {
    name?: string
    clientId?: string
    clientSecret?: string
  }
}

export default function GoogleOAuthButton({ onSuccess, onCancel, initialValues }: GoogleOAuthButtonProps) {
  const [name, setName] = useState(initialValues?.name || '')
  const [clientId, setClientId] = useState(initialValues?.clientId || '')
  const [clientSecret, setClientSecret] = useState(initialValues?.clientSecret || '')
  const [authorizing, setAuthorizing] = useState(false)
  const { addNotification } = useNotifications()

  const handleStartOAuth = async () => {
    if (!name || !clientId || !clientSecret) {
      addNotification('error', 'Please provide all fields')
      return
    }

    setAuthorizing(true)
    console.log('🔐 Starting Google OAuth flow...')

    try {
      // Get authorization URL from backend
      const authData = await fetch('/api/oauth/google/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret })
      }).then(r => r.json())

      if (authData.error) {
        throw new Error(authData.error.message)
      }

      console.log('📱 Opening OAuth popup...')

      // Open popup window
      const popup = window.open(
        authData.authorization_url,
        'google-oauth',
        'width=600,height=700,left=100,top=100'
      )

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.')
      }

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
            console.log('Jewel data:', { name, type: 'gdrive' })

            // Create jewel with the tokens + client credentials
            const jewel = await api.createJewel({
              name: name,
              type: 'gdrive',
              data: {
                refresh_token: tokens.refresh_token,
                client_id: tokens.client_id,
                client_secret: tokens.client_secret
              }
            })

            console.log(`✅ Jewel created: ${jewel.id}`)
            addNotification('success', 'Google Drive connected successfully')
            onSuccess(jewel)
            setAuthorizing(false)

            // Close popup if still open
            if (popup && !popup.closed) {
              popup.close()
            }

            // Remove event listener
            window.removeEventListener('message', handleMessage)

          } catch (error) {
            console.error('❌ Failed to create jewel:', error)
            addNotification('error', error instanceof Error ? error.message : 'Failed to create jewel')
            setAuthorizing(false)
          }
        }
      }

      console.log('👂 Listening for postMessage events...')
      window.addEventListener('message', handleMessage)

      // Also check if popup closes without completing
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed)
          window.removeEventListener('message', handleMessage)
          if (authorizing) {
            setAuthorizing(false)
            console.log('❌ OAuth popup closed without completing')
          }
        }
      }, 500)

    } catch (error) {
      console.error('❌ OAuth initialization failed:', error)
      addNotification('error', error instanceof Error ? error.message : 'Failed to start OAuth')
      setAuthorizing(false)
    }
  }

  return (
    <div className="card space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Connect Google Drive</h3>
        <p className="text-sm text-gray-400 mb-4">
          Enter your Google Cloud project OAuth jewels.
          <a
            href="https://console.cloud.google.com/apis/jewels"
            target="_blank"
            rel="noopener noreferrer"
            className="text-quantum-500 hover:text-quantum-400 ml-1"
          >
            Get jewels →
          </a>
        </p>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-2">Jewel Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Google Drive"
          className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-2">Client ID</label>
        <input
          type="text"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="123456789.apps.googleusercontent.com"
          className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-2">Client Secret</label>
        <input
          type="password"
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          placeholder="GOCSPX-..."
          className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleStartOAuth}
          disabled={authorizing || !name || !clientId || !clientSecret}
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
          onClick={() => onCancel?.()}
          className="btn btn-secondary"
          disabled={authorizing}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
