import { useState, useEffect, useRef } from 'react'
import { 
  Bell, X, Check, Trash2, Filter, Settings, 
  Package, Truck, Wrench, Users, AlertTriangle, 
  CheckCircle, Info, Clock, ChevronRight
} from 'lucide-react'

interface Notification {
  id: string
  type: 'delivery' | 'vehicle' | 'maintenance' | 'announcement' | 'system' | 'alert'
  title: string
  message: string
  timestamp: string
  read: boolean
  actionUrl?: string
  actionLabel?: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
}

interface NotificationsCenterProps {
  isOpen: boolean
  onClose: () => void
}

// Mock notifications - in production, fetch from API
const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'delivery',
    title: 'Delivery Completed',
    message: 'Delivery to Acme Corp has been marked as delivered by John Driver.',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 mins ago
    read: false,
    priority: 'normal',
    actionUrl: '/?tab=deliveries',
    actionLabel: 'View Delivery'
  },
  {
    id: '2',
    type: 'maintenance',
    title: 'Maintenance Due',
    message: 'Vehicle "Van 1" is due for oil change in 2 days.',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
    read: false,
    priority: 'high',
    actionUrl: '/?tab=maintenance',
    actionLabel: 'Schedule'
  },
  {
    id: '3',
    type: 'announcement',
    title: 'Fleet Meeting Tomorrow',
    message: 'Reminder: Monthly fleet safety meeting at 10 AM in Conference Room A.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    read: true,
    priority: 'normal'
  },
  {
    id: '4',
    type: 'alert',
    title: 'Vehicle Delayed',
    message: 'Truck A is running 30 minutes behind schedule due to traffic.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
    read: true,
    priority: 'high',
    actionUrl: '/?tab=vehicles'
  }
]

const typeIcons: Record<string, React.ReactNode> = {
  delivery: <Package className="h-5 w-5 text-blue-600" />,
  vehicle: <Truck className="h-5 w-5 text-green-600" />,
  maintenance: <Wrench className="h-5 w-5 text-orange-600" />,
  announcement: <Users className="h-5 w-5 text-purple-600" />,
  system: <Info className="h-5 w-5 text-gray-600" />,
  alert: <AlertTriangle className="h-5 w-5 text-red-600" />
}

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700'
}

export default function NotificationsCenter({ isOpen, onClose }: NotificationsCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS)
  const [filter, setFilter] = useState<'all' | 'unread' | 'high'>('all')
  const [isLoading, setIsLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read
    if (filter === 'high') return n.priority === 'high' || n.priority === 'urgent'
    return true
  })

  const unreadCount = notifications.filter(n => !n.read).length
  const highPriorityCount = notifications.filter(n => 
    (n.priority === 'high' || n.priority === 'urgent') && !n.read
  ).length

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ))
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const clearAll = () => {
    setNotifications([])
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      
      {/* Panel */}
      <div 
        ref={panelRef}
        className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-slide-in-right"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bell className="h-5 w-5 text-gray-700" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <h2 className="font-semibold text-gray-900">Notifications</h2>
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="p-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition"
                title="Mark all as read"
              >
                <Check className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-white">
          <Filter className="h-4 w-4 text-gray-400" />
          <div className="flex gap-1">
            {(['all', 'unread', 'high'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition ${
                  filter === f
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {f === 'all' && `All (${notifications.length})`}
                {f === 'unread' && `Unread (${unreadCount})`}
                {f === 'high' && `High Priority (${highPriorityCount})`}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Bell className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">
                {filter === 'unread' 
                  ? 'No unread notifications' 
                  : filter === 'high'
                  ? 'No high priority notifications'
                  : 'No notifications'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-gray-50 transition group ${
                    !notification.read ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      <div className={`p-2 rounded-lg ${
                        !notification.read ? 'bg-white' : 'bg-gray-100'
                      }`}>
                        {typeIcons[notification.type]}
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={`font-medium text-sm ${
                            !notification.read ? 'text-gray-900' : 'text-gray-700'
                          }`}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          {!notification.read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="p-1.5 text-primary-600 hover:bg-primary-50 rounded transition"
                              title="Mark as read"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Meta */}
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          priorityColors[notification.priority]
                        }`}>
                          {notification.priority}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(notification.timestamp)}
                        </span>
                        
                        {notification.actionUrl && (
                          <a
                            href={notification.actionUrl}
                            className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-0.5 ml-auto"
                            onClick={() => markAsRead(notification.id)}
                          >
                            {notification.actionLabel || 'View'}
                            <ChevronRight className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t px-4 py-3 bg-gray-50 flex items-center justify-between">
            <button
              onClick={clearAll}
              className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              Clear all
            </button>
            <button className="text-sm text-gray-600 hover:text-gray-700 flex items-center gap-1.5">
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </div>
        )}
      </div>
      
      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
