import { useState } from 'react'

interface InfoTooltipProps {
  text: string
}

export default function InfoTooltip({ text }: InfoTooltipProps) {
  const [showPopover, setShowPopover] = useState(false)

  return (
    <span className="relative inline-block ml-2">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setShowPopover(!showPopover)
        }}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-400 hover:bg-gray-500 dark:bg-gray-600 dark:hover:bg-gray-500 text-white text-xs transition-colors"
        title="Click for more info"
      >
        ⓘ
      </button>

      {showPopover && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPopover(false)}
          />

          {/* Popover */}
          <div className="absolute left-0 top-full mt-2 z-50 w-80 p-4 bg-white dark:bg-quantum-800 border-2 border-quantum-500 rounded-lg shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-gray-700 dark:text-gray-300">{text}</p>
              <button
                onClick={() => setShowPopover(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
    </span>
  )
}
