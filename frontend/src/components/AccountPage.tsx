// Account Page - User profile and MCP token management
import { useAuth, useIsPrime } from '../lib/auth';
import { useState, useEffect } from 'react';
import { PatMetadata } from '../lib/types';
import { useNotifications } from '../lib/notifications';

interface OAuthSession {
  id: string;
  client_id: string;
  client_name: string;
  scope: string;
  created_at: number;
  last_used: number;
}

export default function AccountPage() {
  const { user } = useAuth();
  const isPrime = useIsPrime();
  const { addNotification } = useNotifications();
  const [tokens, setTokens] = useState<PatMetadata[]>([]);
  const [oauthSessions, setOauthSessions] = useState<OAuthSession[]>([]);
  const [showNewToken, setShowNewToken] = useState<string | null>(null);
  const [tokenName, setTokenName] = useState('');
  const [tokenExpiration, setTokenExpiration] = useState<30 | 60 | 90 | 365>(90);
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // Use current domain for MCP URL examples
  const mcpUrl = `${window.location.origin}/mcp`;

  useEffect(() => {
    fetchTokens();
    fetchOAuthSessions();
  }, []);

  const fetchTokens = async () => {
    try {
      const response = await fetch('/api/mcp-tokens');
      const data = await response.json();
      setTokens(data.tokens || []);
    } catch (error) {
      console.error('Failed to fetch tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOAuthSessions = async () => {
    try {
      const response = await fetch('/oauth/sessions');
      const data = await response.json();
      setOauthSessions(data.sessions || []);
    } catch (error) {
      console.error('Failed to fetch OAuth sessions:', error);
    } finally {
      setSessionsLoading(false);
    }
  };

  const revokeOAuthSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to revoke this OAuth session? The client will need to re-authorize.')) {
      return;
    }

    try {
      const response = await fetch(`/oauth/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke session');
      }

      setOauthSessions(oauthSessions.filter(s => s.id !== sessionId));
      addNotification('success', 'OAuth session revoked successfully');
    } catch (error) {
      addNotification('error', 'Failed to revoke OAuth session');
    }
  };

  const generateToken = async () => {
    try {
      const response = await fetch('/api/mcp-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tokenName || 'Personal Access Token',
          expires_in_days: tokenExpiration,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        addNotification('error', error.error || 'Failed to generate token');
        return;
      }

      const data = await response.json();

      // Show token once (never stored)
      setShowNewToken(data.token);
      setTokens([...tokens, data.metadata]);
      setShowTokenForm(false);
      setTokenName('');
      addNotification('success', 'Token generated successfully!');
    } catch (error) {
      addNotification('error', 'Failed to generate token');
    }
  };

  const revokeToken = async (tokenId: string) => {
    if (!confirm('Are you sure you want to revoke this token? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/mcp-tokens/${tokenId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke token');
      }

      setTokens(tokens.filter(t => t.id !== tokenId));
      addNotification('success', 'Token revoked successfully');
    } catch (error) {
      addNotification('error', 'Failed to revoke token');
    }
  };

  if (!user) {
    return <div className="p-8">Loading...</div>;
  }

  const tierColors = {
    observed: 'bg-gray-500',
    coherent: 'bg-blue-500',
    entangled: 'bg-purple-500',
    prime: 'bg-yellow-500'
  };

  return (
    <div className="p-8 space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Account</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage your profile and MCP access</p>
      </div>

      {/* Admin Menu - Prime Only */}
      {isPrime && (
        <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 dark:from-yellow-500/20 dark:to-orange-500/20 rounded-lg shadow p-6 border border-yellow-500/30">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Admin Tools</h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            You have Prime access - manage system configuration, users, and audit logs
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <a
              href="?view=settings"
              className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 hover:border-yellow-500 dark:hover:border-yellow-500 transition-colors group"
            >
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-yellow-500 dark:group-hover:text-yellow-400">
                  Settings
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Configure OAuth applications
                </p>
              </div>
            </a>
            <a
              href="?view=admin-users"
              className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 hover:border-yellow-500 dark:hover:border-yellow-500 transition-colors group"
            >
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-yellow-500 dark:group-hover:text-yellow-400">
                  User Management
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  View and manage user access tiers
                </p>
              </div>
            </a>
            <a
              href="?view=audit-log"
              className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 hover:border-yellow-500 dark:hover:border-yellow-500 transition-colors group"
            >
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-yellow-500 dark:group-hover:text-yellow-400">
                  Audit Log
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Review system activity and changes
                </p>
              </div>
            </a>
          </div>
        </div>
      )}

      {/* User Information */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Profile</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
            <dd className="text-base text-gray-900 dark:text-white">{user.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</dt>
            <dd className="text-base text-gray-900 dark:text-white capitalize">{user.type}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</dt>
            <dd className="text-base text-gray-900 dark:text-white">{user.email || 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Access Tier</dt>
            <dd>
              <span className={`inline-block px-3 py-1 rounded-full text-white text-sm font-medium ${tierColors[user.access_tier]}`}>
                {user.access_tier}
              </span>
            </dd>
          </div>
          {user.last_login && (
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Login</dt>
              <dd className="text-base text-gray-900 dark:text-white">
                {new Date(user.last_login * 1000).toLocaleString()}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* MCP Server Access */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">MCP Server Access</h2>

        {/* OAuth Recommendation */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
          <h3 className="text-sm font-semibold mb-2 text-blue-900 dark:text-blue-100">
            ✨ Recommended: OAuth (Automatic)
          </h3>
          <p className="text-sm mb-3 text-blue-800 dark:text-blue-200">
            Modern MCP clients like Claude Desktop support OAuth - just add the URL and authorize:
          </p>
          <pre className="text-xs bg-white dark:bg-gray-900 p-3 rounded border border-blue-200 dark:border-blue-800 overflow-x-auto">
            {`{
  "mcpServers": {
    "the-great-game": {
      "url": "${mcpUrl}"
    }
  }
}`}
          </pre>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
            The client will automatically open your browser to authorize access.
          </p>
        </div>

        {/* Active OAuth Sessions */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Active OAuth Sessions</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Authorized MCP clients with active access tokens.
          </p>

          {sessionsLoading ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">Loading sessions...</div>
          ) : oauthSessions.length === 0 ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              No active OAuth sessions. Connect an MCP client to create one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Client</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Scope</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Last Used</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {oauthSessions.map(session => (
                    <tr key={session.id}>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {session.client_name}
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {session.client_id.substring(0, 20)}...
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{session.scope}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(session.created_at * 1000).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(session.last_used * 1000).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => revokeOAuthSession(session.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Personal Access Tokens */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Personal Access Tokens</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                For clients that don't support OAuth, or for scripts/automation.
              </p>
            </div>

            {!showTokenForm && (
              <button
                onClick={() => setShowTokenForm(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Generate Token
              </button>
            )}
          </div>

          {/* Token Generation Form */}
          {showTokenForm && (
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Token Name
                </label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="CI Script, Legacy Client, etc."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Expiration
                </label>
                <select
                  value={tokenExpiration}
                  onChange={(e) => setTokenExpiration(Number(e.target.value) as 30 | 60 | 90 | 365)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days (recommended)</option>
                  <option value={365}>365 days</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={generateToken}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Generate Token
                </button>
                <button
                  onClick={() => {
                    setShowTokenForm(false);
                    setTokenName('');
                  }}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* New Token Display */}
          {showNewToken && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded">
              <p className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                ⚠️ Save this token now - it won't be shown again!
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-white dark:bg-gray-900 border border-yellow-300 dark:border-yellow-700 rounded text-xs break-all">
                  {showNewToken}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(showNewToken);
                    addNotification('success', 'Token copied to clipboard!');
                  }}
                  className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 flex-shrink-0"
                  title="Copy to clipboard"
                >
                  Copy
                </button>
              </div>
              <button
                onClick={() => setShowNewToken(null)}
                className="mt-3 text-sm text-yellow-800 dark:text-yellow-200 underline hover:no-underline"
              >
                I've saved it, dismiss this message
              </button>
            </div>
          )}

          {/* Tokens List */}
          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading tokens...</div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No Personal Access Tokens yet. Generate one above to use with MCP clients.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Expires</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Last Used</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {tokens.map(token => {
                    const isExpired = token.expires_at < Math.floor(Date.now() / 1000);
                    return (
                      <tr key={token.id}>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{token.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {new Date(token.created_at * 1000).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={isExpired ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}>
                            {new Date(token.expires_at * 1000).toLocaleDateString()}
                            {isExpired && ' (expired)'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {token.last_used ? new Date(token.last_used * 1000).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => revokeToken(token.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* MCP Configuration Instructions */}
          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
              Show MCP Configuration Instructions
            </summary>
            <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                Add to your MCP client configuration (e.g., Claude Desktop config.json):
              </p>
              <pre className="text-xs bg-white dark:bg-gray-800 p-3 rounded border border-gray-300 dark:border-gray-600 overflow-x-auto">
                {`{
  "mcpServers": {
    "the-great-game": {
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}`}
              </pre>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
