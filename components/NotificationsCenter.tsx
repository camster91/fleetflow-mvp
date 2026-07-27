import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Bell, X, Check, Trash2, Filter,
  Package, Truck, Wrench, Users, AlertTriangle,
  CheckCircle, Info, Clock,
} from 'lucide-react'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  createdAt: string
  read: boolean
  data?: string | null
  priority?: string
}

interface NotificationsCenterProps {
  isOpen: boolean
  onClose: () => void
}

const typeIcons: Record<string, React.ReactNode> = {
  MAINTENANCE_DUE: <Wrench className="h-5 w-5 text-orange-600" />,
  VEHICLE_ALERT: <Truck className="h-5 w-5 text-green-600" />,
  TEAM_INVITE: <Users className="h-5 w-5 text-purple-600" />,
  BILLING: <Info className="h-5 w-5 text-blue-600" />,
  SYSTEM: <Info className="h-5 w-5 text-gray-600" />,
  SECURITY: <AlertTriangle className="h-5 w-5 text-red-600" />,
  delivery: <Package className="h-5 w-5 text-blue-600" />,
  maintenance: <Wrench className="h-5 w-5 text-orange-600" />,
  announcement: <Users className="h-5 w-5 text-purple-600" />,
  alert: <AlertTriangle className="h-5 w-5 text-red-600" />,
}

function formatTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

export default function NotificationsCenter({ isOpen, onClose }: NotificationsCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [isLoading, setIsLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    if (!isOpen) return
    setIsLoading(true)
    try {
      const r = await fetch('/api/notifications?limit=30')
      if (r.ok) {
        const data = await r.json()
        setNotifications(data.notifications ?? [])
      }
    } catch {}
    finally { setIsLoading(false) }
  }, [isOpen])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  const markRead = async (ids: string[]) => {
    const r = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationIds: ids }),
    })
    if (!r.ok) return
    setNotifications((prev) => prev.map((n) => ids.includes(n.id) ? { ...n, read: true } : n))
  }

  const markAllRead = async () => {
    const r = await fetch('/api/notifications', { method: 'PUT' })
    if (!r.ok) return
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const deleteNotification = async (id: string) => {
    const r = await fetch(`/api/notifications?id=${id}`, { method: 'DELETE' })
    if (!r.ok) return
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const filtered = notifications.filter((n) => filter === 'all' || !n.read)
  const unreadCount = notifications.filter((n) => !n.read).length

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pt-16 pr-4" aria-modal="true">
      <div ref={panelRef} className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Bell className="h-5 w-5 text-slate-700" />
            <span className="font-semibold text-slate-900">Notifications</span>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">{unreadCount}</span>
            )}
          </div>
          <div className="flex items-center space-x-1">
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="p-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> All read
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
              <X className="h-4 w-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex px-4 py-2 gap-2 border-b border-slate-100">
          {(['all', 'unread'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === f ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {f === 'all' ? 'All' : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Clock className="h-5 w-5 animate-spin mr-2" /> Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <CheckCircle className="h-10 w-10 mb-2 text-emerald-400" />
              <p className="text-sm font-medium">All caught up!</p>
              <p className="text-xs mt-1">{filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {filtered.map((n) => (
                <li key={n.id} className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${
                  !n.read ? 'bg-blue-50/40' : ''
                }`}>
                  <div className="mt-0.5 shrink-0">{typeIcons[n.type] ?? <Info className="h-5 w-5 text-gray-500" />}</div>
                  <div className="flex-1 min-w-0" onClick={() => !n.read && markRead([n.id])}>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-medium truncate ${!n.read ? 'text-slate-900' : 'text-slate-600'}`}>{n.title}</p>
                      <span className="text-xs text-slate-400 shrink-0">{formatTime(n.createdAt)}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                  </div>
                  <button onClick={() => deleteNotification(n.id)} className="shrink-0 p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
