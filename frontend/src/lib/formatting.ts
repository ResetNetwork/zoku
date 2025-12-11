// Shared formatting utilities

export const formatDate = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleString()
}

export const formatRelativeTime = (timestamp: number) => {
  const seconds = Math.floor(Date.now() / 1000 - timestamp)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export const SOURCE_COLORS: Record<string, string> = {
  github: 'bg-purple-500/20 text-purple-300',
  zammad: 'bg-blue-500/20 text-blue-300',
  gdrive: 'bg-green-500/20 text-green-300',
  mcp: 'bg-gray-500/20 text-gray-300'
}

export const getSourceColor = (source: string) => {
  return SOURCE_COLORS[source] || 'bg-gray-500/20 text-gray-300'
}
