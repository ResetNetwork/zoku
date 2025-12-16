import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { AuthProvider } from './lib/auth'
import { NotificationProvider, NotificationContainer } from './lib/notifications'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      refetchInterval: 60000
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <NotificationProvider>
      <AuthProvider>
        <App />
        <NotificationContainer />
      </AuthProvider>
    </NotificationProvider>
  </QueryClientProvider>
)
