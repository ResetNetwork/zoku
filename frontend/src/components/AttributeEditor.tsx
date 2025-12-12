import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useNotifications } from '../lib/notifications'

interface AttributeEditorProps {
  entanglementId: string
}

export default function AttributeEditor({ entanglementId }: AttributeEditorProps) {
  const [editing, setEditing] = useState(false)
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const queryClient = useQueryClient()
  const { addNotification } = useNotifications()

  const { data: dimensions } = useQuery({
    queryKey: ['dimensions'],
    queryFn: () => api.listDimensions()
  })

  const { data: currentAttributes } = useQuery({
    queryKey: ['attributes', entanglementId],
    queryFn: () => api.getEntanglementAttributes(entanglementId)
  })

  // Initialize selected attributes from current values
  useEffect(() => {
    if (currentAttributes?.attributes) {
      const attrs: Record<string, string> = {}
      Object.entries(currentAttributes.attributes).forEach(([key, value]: [string, any]) => {
        if (value.values && value.values.length > 0) {
          attrs[key] = value.values[0].value
        }
      })
      setSelectedAttributes(attrs)
    }
  }, [currentAttributes])

  const handleSave = async () => {
    setSaving(true)
    try {
      const attributes = Object.entries(selectedAttributes)
        .filter(([_, value]) => value) // Only include selected values
        .map(([dimension, value]) => ({ dimension, value }))

      await api.setEntanglementAttributes(entanglementId, attributes)
      addNotification('success', 'Categories updated')
      queryClient.invalidateQueries({ queryKey: ['attributes', entanglementId] })
      queryClient.invalidateQueries({ queryKey: ['volition', entanglementId] })
      setEditing(false)
    } catch (error) {
      console.error('Failed to update attributes:', error)
      addNotification('error', 'Failed to update categories')
    } finally {
      setSaving(false)
    }
  }

  // Get available values for a dimension, filtered by dependencies
  const getAvailableValues = (dimensionName: string) => {
    const dim = dimensions?.dimensions?.find((d: any) => d.name === dimensionName)
    if (!dim) return []

    let values = dim.values || []

    // Filter based on dependencies
    if (dimensionName === 'pillar' && selectedAttributes.function !== 'tech_innovation') {
      return []
    }
    if (dimensionName === 'service_area' && selectedAttributes.function !== 'info_tech') {
      return []
    }

    return values
  }

  if (!dimensions || !currentAttributes) {
    return <div className="text-gray-400 text-sm">Loading categories...</div>
  }

  // Display current attributes
  if (!editing) {
    const hasAttributes = currentAttributes.attributes && Object.keys(currentAttributes.attributes).length > 0

    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Dimensions</h2>
          <button
            onClick={() => setEditing(true)}
            className="btn btn-secondary text-sm"
          >
            Edit
          </button>
        </div>

        {!hasAttributes ? (
          <div className="text-gray-400 text-sm">No dimensions set</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(currentAttributes.attributes).map(([key, value]: [string, any]) => (
              <div key={key} className="flex flex-col gap-1">
                <span className="text-xs text-gray-500 uppercase">{value.label}</span>
                <div className="flex flex-wrap gap-1">
                  {value.values?.map((v: any) => (
                    <span
                      key={v.value}
                      className="px-3 py-1 rounded-full bg-quantum-500/20 text-quantum-300 text-sm font-medium"
                    >
                      {v.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Edit mode
  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">Edit Dimensions</h2>

      <div className="space-y-4">
        {dimensions.dimensions?.map((dim: any) => {
          const availableValues = getAvailableValues(dim.name)

          // Don't show dimension if no values available (due to dependencies)
          if (availableValues.length === 0 && dim.name !== 'status' && dim.name !== 'function') {
            return null
          }

          return (
            <div key={dim.name}>
              <label className="block text-sm text-gray-400 mb-2">
                {dim.label}
                {dim.description && (
                  <span className="text-xs text-gray-500 ml-2">({dim.description})</span>
                )}
              </label>
              <select
                value={selectedAttributes[dim.name] || ''}
                onChange={(e) => setSelectedAttributes({
                  ...selectedAttributes,
                  [dim.name]: e.target.value
                })}
                className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-quantum-700 border border-gray-300 dark:border-quantum-600 text-gray-900 dark:text-gray-100"
              >
                <option value="">None</option>
                {availableValues.map((v: any) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex-1"
        >
          {saving ? 'Saving...' : 'Save Dimensions'}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="btn btn-secondary"
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
