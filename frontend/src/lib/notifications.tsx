import { createContext, useContext, useState, ReactNode } from 'react'

type NotificationType = 'success' | 'error' | 'info'

interface Notification {
  id: string
  type: NotificationType
  message: string
  timestamp: number
}

interface NotificationContextType {
  notifications: Notification[]
  addNotification: (type: NotificationType, message: string) => void
  removeNotification: (id: string) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = (type: NotificationType, message: string) => {
    const id = `${Date.now()}-${Math.random()}`
    const notification = { id, type, message, timestamp: Date.now() }

    setNotifications(prev => [...prev, notification])

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 5000)
  }

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}

export function NotificationContainer() {
  const { notifications, removeNotification } = useNotifications()

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`p-4 rounded-lg shadow-lg border animate-slide-in ${
            notification.type === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : notification.type === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm flex-1">{notification.message}</p>
            <button
              onClick={() => removeNotification(notification.id)}
              className="text-gray-400 hover:text-gray-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
