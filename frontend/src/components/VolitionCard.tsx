import type { Volition } from '../lib/types'

interface VolitionCardProps {
  volition: Volition
  onClick: (id: string) => void
}

export default function VolitionCard({ volition, onClick }: VolitionCardProps) {
  return (
    <button
      onClick={() => onClick(volition.id)}
      className="w-full text-left p-4 bg-gray-100 dark:bg-quantum-700/50 hover:bg-gray-200 dark:hover:bg-quantum-700 rounded-lg border border-gray-300 dark:border-quantum-600 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-1">{volition.name}</h3>
          {volition.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {volition.description}
            </p>
          )}

          {/* Categories as badges */}
          {volition.attributes && Object.keys(volition.attributes).length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {Object.entries(volition.attributes).map(([key, value]) => (
                <span
                  key={key}
                  className="px-2 py-0.5 rounded-full bg-quantum-500/20 text-quantum-300 text-xs font-medium"
                  title={key}
                >
                  {typeof value === 'string' ? value : value}
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-4 text-xs text-gray-500">
            <div>{volition.entangled_count || 0} entangled</div>
            <div>•</div>
            <div>{volition.qupts_count || 0} qupts</div>
            <div>•</div>
            <div>{volition.sources_count || 0} sources</div>
          </div>
        </div>
        <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  )
}
