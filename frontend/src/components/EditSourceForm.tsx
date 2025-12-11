import { useState } from 'react'
import { useNotifications } from '../lib/notifications'

interface EditSourceFormProps {
  source: any
  onSuccess: () => void
  onCancel: () => void
}

export default function EditSourceForm({ source, onSuccess, onCancel }: EditSourceFormProps) {
  const config = typeof source.config === 'string' ? JSON.parse(source.config) : source.config
  const [formConfig, setFormConfig] = useState(config)
  const [updating, setUpdating] = useState(false)
  const { addNotification } = useNotifications()

  const handleUpdate = async () => {
    setUpdating(true)
    try {
      const response = await fetch(`/api/sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: formConfig })
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error.message)
      }

      addNotification('success', 'Source updated')
      onSuccess()
    } catch (error) {
      console.error('Failed to update source:', error)
      addNotification('error', error instanceof Error ? error.message : 'Failed to update source')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="card space-y-4 mb-4">
      <h3 className="text-lg font-semibold">Edit {source.type} Source</h3>

      {/* GitHub Config */}
      {source.type === 'github' && (
        <>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Owner</label>
            <input
              type="text"
              value={formConfig.owner}
              onChange={(e) => setFormConfig({ ...formConfig, owner: e.target.value })}
              className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Repository</label>
            <input
              type="text"
              value={formConfig.repo}
              onChange={(e) => setFormConfig({ ...formConfig, repo: e.target.value })}
              className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
            />
          </div>
        </>
      )}

      {/* Zammad Config */}
      {source.type === 'zammad' && (
        <>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Tag</label>
            <input
              type="text"
              value={formConfig.tag}
              onChange={(e) => setFormConfig({ ...formConfig, tag: e.target.value })}
              className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="edit-include-articles"
              checked={formConfig.include_articles}
              onChange={(e) => setFormConfig({ ...formConfig, include_articles: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="edit-include-articles" className="text-sm text-gray-400">Include ticket articles</label>
          </div>
        </>
      )}

      {/* Google Docs Config */}
      {source.type === 'gdrive' && (
        <div>
          <label className="block text-sm text-gray-400 mb-2">File or Folder URL</label>
          <input
            type="text"
            value={formConfig.document_id}
            onChange={(e) => {
              const url = e.target.value
              let id = url

              const docsMatch = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/)
              if (docsMatch) id = docsMatch[1]

              const folderMatch = url.match(/\/folders\/([a-zA-Z0-9-_]+)/)
              if (folderMatch) id = folderMatch[1]

              const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/)
              if (fileMatch) id = fileMatch[1]

              setFormConfig({ ...formConfig, document_id: id })
            }}
            placeholder="https://docs.google.com/document/d/... or ID"
            className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
          />
          <p className="text-xs text-gray-500 mt-1">Paste Google Docs/Drive URL or enter ID directly</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleUpdate}
          disabled={updating}
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex-1"
        >
          {updating ? 'Updating...' : 'Update Source'}
        </button>
        <button
          onClick={onCancel}
          className="btn btn-secondary"
          disabled={updating}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
