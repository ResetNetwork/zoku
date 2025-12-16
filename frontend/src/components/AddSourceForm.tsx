import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useNotifications } from '../lib/notifications'

interface AddSourceFormProps {
  entanglementId: string
  onSuccess: () => void
  onCancel: () => void
}

export default function AddSourceForm({ entanglementId, onSuccess, onCancel }: AddSourceFormProps) {
  const [sourceType, setSourceType] = useState<'github' | 'zammad' | 'gdrive' | 'gmail'>('github')
  const [selectedJewel, setSelectedJewel] = useState('')
  const [config, setConfig] = useState<any>({
    // GitHub defaults
    owner: '',
    repo: '',
    events: ['push', 'pull_request', 'issues']
  })
  const [adding, setAdding] = useState(false)
  const { addNotification } = useNotifications()

  const { data: jewels = [] } = useQuery({
    queryKey: ['jewels'],
    queryFn: () => api.listJewels()
  })

  // Filter jewels by type
  const availableJewels = jewels.filter((c: any) => c.type === sourceType)

  const handleTypeChange = (type: 'github' | 'zammad' | 'gdrive' | 'gmail') => {
    setSourceType(type)
    setSelectedJewel('')
    // Reset config based on type
    if (type === 'github') {
      setConfig({ owner: '', repo: '', events: ['push', 'pull_request', 'issues'] })
    } else if (type === 'zammad') {
      setConfig({ tag: '', include_articles: true })
    } else if (type === 'gdrive') {
      setConfig({ document_id: '', track_suggestions: false })
    } else if (type === 'gmail') {
      setConfig({ label: '' })
    }
  }

  const handleAddSource = async () => {
    if (!selectedJewel) {
      addNotification('error', 'Please select a jewel')
      return
    }

    // Validate config based on type
    if (sourceType === 'github' && (!config.owner || !config.repo)) {
      addNotification('error', 'Please provide owner and repo for GitHub source')
      return
    }
    if (sourceType === 'zammad' && !config.tag) {
      addNotification('error', 'Please provide tag for Zammad source')
      return
    }
    if (sourceType === 'gdrive' && !config.document_id) {
      addNotification('error', 'Please provide document ID for Google Docs source')
      return
    }
    if (sourceType === 'gmail' && !config.label) {
      addNotification('error', 'Please provide label for Gmail source')
      return
    }

    setAdding(true)
    try {
      const response = await fetch(`/api/entanglements/${entanglementId}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: sourceType,
          jewel_id: selectedJewel,
          config
        })
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error.message)
      }

      console.log('✅ Source added:', data)

      // Show success with validation details if available
      if (data.validation && data.validation.document_title) {
        addNotification('success', `Source added: ${data.validation.document_title}`)
      } else if (data.warnings && data.warnings.length > 0) {
        addNotification('success', `Source added (with warnings: ${data.warnings.join(', ')})`)
      } else {
        addNotification('success', 'Source added successfully')
      }

      onSuccess()
    } catch (error) {
      console.error('Failed to add source:', error)
      addNotification('error', error instanceof Error ? error.message : 'Failed to add source')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="card space-y-4">
      <h3 className="text-lg font-semibold">Add Source</h3>

      {/* Source Type */}
      <div>
        <label className="block text-sm text-gray-400 mb-2">Source Type</label>
        <select
          value={sourceType}
          onChange={(e) => handleTypeChange(e.target.value as any)}
          className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
        >
          <option value="github">GitHub</option>
          <option value="zammad">Zammad</option>
          <option value="gdocs">Google Drive</option>
          <option value="gmail">Gmail</option>
        </select>
      </div>

      {/* Jewel Selector */}
      <div>
        <label className="block text-sm text-gray-400 mb-2">Jewel</label>
        {availableJewels.length === 0 ? (
          <div className="text-sm text-gray-400 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
            No {sourceType} jewels found. Create one in the Jewels page first.
          </div>
        ) : (
          <select
            value={selectedJewel}
            onChange={(e) => setSelectedJewel(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
          >
            <option value="">Select jewel...</option>
            {availableJewels.map((cred: any) => (
              <option key={cred.id} value={cred.id}>{cred.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* GitHub Config */}
      {sourceType === 'github' && (
        <>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Owner</label>
            <input
              type="text"
              value={config.owner}
              onChange={(e) => setConfig({ ...config, owner: e.target.value })}
              placeholder="ResetNetwork"
              className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Repository</label>
            <input
              type="text"
              value={config.repo}
              onChange={(e) => setConfig({ ...config, repo: e.target.value })}
              placeholder="zoku"
              className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
            />
          </div>
        </>
      )}

      {/* Zammad Config */}
      {sourceType === 'zammad' && (
        <>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Tag (required)</label>
            <input
              type="text"
              value={config.tag}
              onChange={(e) => setConfig({ ...config, tag: e.target.value })}
              placeholder="zoku"
              className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">Only tickets with this tag will be collected</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="include-articles"
              checked={config.include_articles}
              onChange={(e) => setConfig({ ...config, include_articles: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="include-articles" className="text-sm text-gray-400">Include ticket articles</label>
          </div>
        </>
      )}

      {/* Google Drive Config */}
      {sourceType === 'gdrive' && (
        <>
          <div>
            <label className="block text-sm text-gray-400 mb-2">File or Folder URL</label>
            <input
              type="text"
              value={config.document_id}
              onChange={(e) => {
                // Extract document/folder ID from URL if pasted
                const url = e.target.value
                let id = url

                // Extract from Google Docs URL: https://docs.google.com/document/d/DOCUMENT_ID/...
                const docsMatch = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/)
                if (docsMatch) {
                  id = docsMatch[1]
                }

                // Extract from Google Drive URL: https://drive.google.com/drive/folders/FOLDER_ID
                const folderMatch = url.match(/\/folders\/([a-zA-Z0-9-_]+)/)
                if (folderMatch) {
                  id = folderMatch[1]
                }

                // Extract from file URL: https://drive.google.com/file/d/FILE_ID/...
                const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/)
                if (fileMatch) {
                  id = fileMatch[1]
                }

                setConfig({ ...config, document_id: id })
              }}
              placeholder="https://docs.google.com/document/d/... or ID"
              className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">Paste Google Docs/Drive URL or enter ID directly</p>
          </div>
        </>
      )}

      {/* Gmail Config */}
      {sourceType === 'gmail' && (
        <>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Gmail Label</label>
            <input
              type="text"
              value={config.label}
              onChange={(e) => setConfig({ ...config, label: e.target.value })}
              placeholder="zoku"
              className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the name of a Gmail label (e.g., "zoku", "project", "important"). 
              Only messages with this label will be collected.
            </p>
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleAddSource}
          disabled={adding || !selectedJewel}
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex-1"
        >
          {adding ? 'Adding Source...' : 'Add Source'}
        </button>
        <button
          onClick={onCancel}
          className="btn btn-secondary"
          disabled={adding}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
