import { useState } from 'react'
import type { Qupt } from '../lib/types'
import { formatDate, formatRelativeTime, getSourceColor } from '../lib/formatting'

interface QuptItemProps {
  qupt: Qupt
  showEntanglementName?: boolean
}

export default function QuptItem({ qupt, showEntanglementName = false }: QuptItemProps) {
  const [expanded, setExpanded] = useState(false)

  const metadata = qupt.metadata
    ? (typeof qupt.metadata === 'string' ? JSON.parse(qupt.metadata) : qupt.metadata)
    : null

  const getGitHubIcon = (eventType: string) => {
    switch (eventType) {
      case 'PushEvent':
        return '←' // Commit/push arrow
      case 'PullRequestEvent':
        return '⇄' // PR merge/fork symbol
      case 'IssuesEvent':
        return '◆' // Issue diamond
      case 'IssueCommentEvent':
        return '💬' // Comment bubble
      default:
        return null
    }
  }

  const getZammadIcon = (type: string) => {
    switch (type) {
      case 'ticket':
        return '◆' // Diamond for ticket (matches GitHub issues)
      case 'phone':
        return '📞' // Phone
      case 'email':
        return '📧' // Email
      case 'note':
        return '📝' // Note
      case 'article':
        return '💬' // Comment/article (matches GitHub comments)
      default:
        return '💬' // Generic communication
    }
  }

  const getGmailIcon = () => {
    return '📧' // Email icon for Gmail
  }

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case 'PushEvent':
        return 'text-purple-400'
      case 'PullRequestEvent':
        return 'text-green-400'
      case 'IssuesEvent':
        return 'text-blue-400'
      case 'IssueCommentEvent':
        return 'text-yellow-400'
      default:
        return 'text-gray-400'
    }
  }

  const getZammadTypeColor = (type: string) => {
    switch (type) {
      case 'ticket':
        return 'text-blue-400'
      case 'phone':
        return 'text-purple-400'
      case 'email':
        return 'text-green-400'
      case 'note':
        return 'text-yellow-400'
      default:
        return 'text-gray-400'
    }
  }

  // Format content dynamically from metadata for all sources
  const formatContent = () => {
    if (!metadata) return qupt.content;

    // GitHub formatting
    if (qupt.source === 'github') {
      if (metadata.event_type === 'PushEvent') {
        const branch = metadata.payload?.ref?.replace('refs/heads/', '') || 'main';
        const sha = metadata.payload?.head?.substring(0, 7) || '???????';
        // Use only first line of commit message
        const fullMessage = metadata.commit_message || 'Commit';
        const message = fullMessage.split('\n')[0];
        return `${branch} ← ${sha}: ${message}`;
      }
      if (metadata.event_type === 'PullRequestEvent') {
        const prNumber = metadata.pr_number || metadata.payload?.pull_request?.number;
        const title = metadata.pr_title || metadata.payload?.pull_request?.title;
        const action = metadata.action || metadata.payload?.action;
        return `#${prNumber}: ${title} [${action}]`;
      }
      if (metadata.event_type === 'IssuesEvent') {
        const issueNumber = metadata.issue_number || metadata.payload?.issue?.number;
        const title = metadata.issue_title || metadata.payload?.issue?.title;
        const action = metadata.action || metadata.payload?.action;
        return `#${issueNumber}: ${title} [${action}]`;
      }
      if (metadata.event_type === 'IssueCommentEvent') {
        const issueNumber = metadata.issue_number || metadata.payload?.issue?.number;
        const title = metadata.issue_title || metadata.payload?.issue?.title;
        return `#${issueNumber}: ${title} [comment]`;
      }
    }

    // Zammad formatting
    if (qupt.source === 'zammad') {
      if (metadata.type === 'ticket') {
        return `Ticket #${metadata.ticket_number} [${metadata.state || 'unknown'}]: ${metadata.title}`;
      }
      if (metadata.type === 'note' || metadata.type === 'email' || metadata.type === 'phone') {
        return `${metadata.type} on #${metadata.ticket_number} from ${metadata.from || metadata.sender || 'Unknown'}`;
      }
    }

    // Google Drive formatting
    if (qupt.source === 'gdrive') {
      if (metadata.type === 'revision') {
        return `${metadata.document_title}: Edited by ${metadata.modified_by || 'Someone'}`;
      }
      if (metadata.type === 'comment') {
        return `${metadata.document_title}: Comment by ${metadata.author || 'Someone'}`;
      }
    }

    // Gmail formatting
    if (qupt.source === 'gmail') {
      const from = metadata.from || 'Unknown sender';
      const subject = metadata.subject || '(no subject)';
      
      // Determine if incoming or outgoing
      // Simple heuristic: if 'from' contains common outgoing indicators
      const isOutgoing = from.toLowerCase().includes('me') || 
                        from.toLowerCase().includes('you') ||
                        from.toLowerCase().includes(metadata.user_email || '');
      
      const direction = isOutgoing ? '→' : '←';
      
      return `${direction} ${from}: ${subject}`;
    }

    // Fallback to stored content
    return qupt.content;
  }

  return (
    <div className="bg-gray-100 dark:bg-quantum-700/30 rounded-lg border border-gray-300 dark:border-quantum-600 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 text-left hover:bg-gray-200 dark:hover:bg-quantum-700/50 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-gray-900 dark:text-gray-200 flex-1">{formatContent()}</p>
              {metadata?.url && (
                <a
                  href={metadata.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-gray-400 hover:text-quantum-500 transition-colors flex-shrink-0"
                  title="View source"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                {showEntanglementName && qupt.entanglement_name && (
                  <span className="px-2 py-0.5 rounded-full bg-quantum-500/20 text-quantum-300 font-medium">
                    {qupt.entanglement_name}
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded-full ${getSourceColor(qupt.source)}`}>
                  {qupt.source}
                </span>
                {metadata?.event_type && qupt.source === 'github' && getGitHubIcon(metadata.event_type) && (
                  <span
                    className={`text-sm font-semibold ${getEventTypeColor(metadata.event_type)}`}
                    title={metadata.event_type}
                  >
                    {getGitHubIcon(metadata.event_type)}
                  </span>
                )}
                {metadata?.type && qupt.source === 'zammad' && (
                  <span
                    className={`text-sm ${getZammadTypeColor(metadata.type)}`}
                    title={metadata.type}
                  >
                    {getZammadIcon(metadata.type)}
                  </span>
                )}
                {metadata?.type && qupt.source === 'gdrive' && (
                  <span
                    className={`text-sm font-semibold ${
                      metadata.type === 'revision' ? 'text-purple-400' : 'text-yellow-400'
                    }`}
                    title={metadata.type}
                  >
                    {metadata.type === 'revision' ? '←' : '💬'}
                  </span>
                )}
                {qupt.source === 'gmail' && (
                  <span
                    className="text-sm text-blue-400"
                    title="Gmail message"
                  >
                    {getGmailIcon()}
                  </span>
                )}
              </div>
              <span>•</span>
              <span>{formatRelativeTime(qupt.created_at)}</span>
              <span>•</span>
              <span className="text-gray-600 dark:text-gray-500">{formatDate(qupt.created_at)}</span>
            </div>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && metadata && (
        <div className="px-3 pb-3 border-t border-gray-300 dark:border-quantum-600 pt-3 mt-0">
          <div className="text-sm space-y-2">
            {/* GitHub-specific metadata */}
            {qupt.source === 'github' && (
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  {metadata.event_type && (
                    <span className="text-gray-600 dark:text-gray-400">
                      <span className="font-semibold">Event:</span> {metadata.event_type}
                    </span>
                  )}
                  {metadata.action && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      metadata.action === 'opened' ? 'bg-green-500/20 text-green-400' :
                      metadata.action === 'closed' ? 'bg-red-500/20 text-red-400' :
                      metadata.action === 'reopened' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {metadata.action}
                    </span>
                  )}
                  {metadata.issue_number && (
                    <span className="text-gray-600 dark:text-gray-400">
                      <span className="font-semibold">#{metadata.issue_number}</span>
                    </span>
                  )}
                  {metadata.actor && (
                    <span className="text-gray-600 dark:text-gray-400">
                      by @{metadata.actor}
                    </span>
                  )}
                </div>

                {metadata.repo && (
                  <div className="text-gray-600 dark:text-gray-400 text-sm">
                    <span className="font-semibold">Repo:</span> {metadata.repo}
                  </div>
                )}

                {/* Commit Message */}
                {metadata.commit_message && (
                  <div className="text-gray-700 dark:text-gray-300 mt-2 p-3 bg-gray-100 dark:bg-quantum-900/30 rounded border-l-2 border-quantum-500">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Commit Message:</div>
                    <pre className="text-sm whitespace-pre-wrap font-mono">{metadata.commit_message}</pre>
                  </div>
                )}

                {/* Issue Body */}
                {metadata.issue_body && (
                  <div className="text-gray-700 dark:text-gray-300 mt-2 p-3 bg-gray-100 dark:bg-quantum-900/30 rounded border-l-2 border-green-500">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Issue Description:</div>
                    <div className="text-sm whitespace-pre-wrap">{metadata.issue_body}</div>
                  </div>
                )}

                {/* Comment Body */}
                {metadata.comment_body && (
                  <div className="text-gray-700 dark:text-gray-300 mt-2 p-3 bg-gray-100 dark:bg-quantum-900/30 rounded border-l-2 border-blue-500">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Comment:</div>
                    <div className="text-sm whitespace-pre-wrap">{metadata.comment_body}</div>
                  </div>
                )}

                {metadata.payload && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-gray-500 dark:text-gray-400 text-xs hover:text-gray-700 dark:hover:text-gray-300">
                      Raw payload
                    </summary>
                    <pre className="mt-2 p-2 bg-gray-200 dark:bg-quantum-900/50 rounded text-xs overflow-x-auto">
                      {JSON.stringify(metadata.payload, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Google Drive-specific metadata */}
            {qupt.source === 'gdrive' && (
              <div className="space-y-2">
                {metadata.type === 'comment' && (
                  <>
                    {/* Quoted/highlighted text */}
                    {metadata.quoted_content && (
                      <div className="p-3 bg-yellow-500/10 dark:bg-yellow-500/5 rounded border-l-2 border-yellow-500">
                        <div className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 mb-1">
                          Highlighted text:
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          "{metadata.quoted_content}"
                        </div>
                      </div>
                    )}

                    {/* Full comment */}
                    <div className="p-3 bg-gray-100 dark:bg-quantum-900/30 rounded border-l-2 border-quantum-500">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                          Comment by {metadata.author || 'Unknown'}
                        </div>
                        {metadata.resolved && (
                          <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">
                            Resolved
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {qupt.content.split(': ').slice(1).join(': ')}
                      </div>
                    </div>
                  </>
                )}

                {metadata.type === 'revision' && metadata.modified_by && (
                  <div className="text-gray-600 dark:text-gray-400 text-sm">
                    <span className="font-semibold">Edited by:</span> {metadata.modified_by}
                    {metadata.modified_by_email && ` (${metadata.modified_by_email})`}
                  </div>
                )}
              </div>
            )}

            {/* Zammad-specific metadata */}
            {qupt.source === 'zammad' && (
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  {metadata.type && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      metadata.type === 'ticket' ? 'bg-blue-500/20 text-blue-400' :
                      metadata.type === 'note' ? 'bg-yellow-500/20 text-yellow-400' :
                      metadata.type === 'email' ? 'bg-green-500/20 text-green-400' :
                      metadata.type === 'phone' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {metadata.type}
                    </span>
                  )}
                  {metadata.ticket_number && (
                    <span className="text-gray-600 dark:text-gray-400">
                      <span className="font-semibold">#{metadata.ticket_number}</span>
                    </span>
                  )}
                </div>

                {(metadata.body || metadata.note) && metadata.type === 'ticket' && (
                  <div className="text-gray-700 dark:text-gray-300 mt-2 p-3 bg-gray-100 dark:bg-quantum-900/30 rounded border-l-2 border-blue-500">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Ticket Description:</div>
                    <div className="text-sm whitespace-pre-wrap">{metadata.body || metadata.note}</div>
                  </div>
                )}

                {metadata.type !== 'ticket' && (
                  <div className="space-y-1">
                    {metadata.from && (
                      <div className="text-gray-600 dark:text-gray-400 text-sm">
                        <span className="font-semibold">From:</span> {metadata.from}
                      </div>
                    )}
                    {metadata.subject && (
                      <div className="text-gray-600 dark:text-gray-400 text-sm">
                        <span className="font-semibold">Subject:</span> {metadata.subject}
                      </div>
                    )}
                    {metadata.body && (
                      <div className="text-gray-700 dark:text-gray-300 mt-2 p-3 bg-gray-100 dark:bg-quantum-900/30 rounded border-l-2 border-yellow-500">
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Article Content:</div>
                        <div className="text-sm whitespace-pre-wrap">{metadata.body}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Gmail-specific metadata */}
            {qupt.source === 'gmail' && (
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  {metadata.from && (
                    <span className="text-gray-600 dark:text-gray-400">
                      <span className="font-semibold">From:</span> {metadata.from}
                    </span>
                  )}
                  {metadata.date && (
                    <span className="text-gray-600 dark:text-gray-400">
                      <span className="font-semibold">Date:</span> {metadata.date}
                    </span>
                  )}
                </div>

                {metadata.subject && (
                  <div className="text-gray-600 dark:text-gray-400 text-sm">
                    <span className="font-semibold">Subject:</span> {metadata.subject}
                  </div>
                )}

                {metadata.label && (
                  <div className="text-gray-600 dark:text-gray-400 text-sm">
                    <span className="font-semibold">Label:</span> <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs">{metadata.label}</span>
                  </div>
                )}

                {(metadata.body || metadata.body_preview) && (
                  <div className="text-gray-700 dark:text-gray-300 mt-2 p-3 bg-gray-100 dark:bg-quantum-900/30 rounded border-l-2 border-blue-500">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                      {metadata.body ? 'Message Body:' : 'Message Preview:'}
                    </div>
                    <div className="text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                      {metadata.body || metadata.body_preview}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Fallback for other sources */}
            {!['github', 'zammad', 'gdrive', 'gmail'].includes(qupt.source) && (
              <pre className="p-2 bg-gray-200 dark:bg-quantum-900/50 rounded text-xs overflow-x-auto">
                {JSON.stringify(metadata, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
