import { useState, useEffect, useCallback } from 'react'
import { Bell, Trash2, Check, CheckCircle, Info, Wrench, Truck, Users, AlertTriangle, Filter } from 'lucide-react'
import { DashboardLayout } from '../../components/layouts/DashboardLayout'
import { PageHeader } from '../../components/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { SkeletonTable } from '../../components/ui/Skeleton'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  createdAt: string
  read: boolean
}

const typeIcon: Record<string, React.ReactNode> = {
  MAINTENANCE_DUE: <Wrench className="h-5 w-5 text-orange-500" />,
  VEHICLE_ALERT: <Truck className="h-5 w-5 text-green-600" />,
  TEAM_INVITE: <Users className="h-5 w-5 text-purple-600" />,
  SECURITY: <AlertTriangle className="h-5 w-5 text-red-500" />,
  SYSTEM: <Info className="h-5 w-5 text-blue-500" />,
  BILLING: <Info className="h-5 w-5 text-blue-500" />,
}

function fmtTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago'
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago'
  return new Date(ts).toLocaleDateString()
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [cursor, setCursor] = useState<string | undefined>()
  const [hasMore, setHasMore] = useState(false)

  const load = useCallback(
    async (requestCursor?: string) => {
      const reset = !requestCursor
      if (reset) setIsLoading(true)
      try {
        const params = new URLSearchParams({
          limit: '20',
          ...(filter === 'unread' && { unreadOnly: 'true' }),
          ...(requestCursor ? { cursor: requestCursor } : {}),
        })
        const r = await fetch('/api/notifications?' + params)
        if (r.ok) {
          const data = await r.json()
          setNotifications((prev) => (reset ? (data.notifications ?? []) : [...prev, ...(data.notifications ?? [])]))
          setHasMore(data.hasMore ?? false)
          setCursor(data.nextCursor)
        }
      } finally {
        setIsLoading(false)
      }
    },
    [filter]
  )

  useEffect(() => {
    void load()
  }, [load])

  const markRead = async (ids: string[]) => {
    const r = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationIds: ids }),
    })
    if (!r.ok) return
    setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)))
  }
  const markAllRead = async () => {
    const r = await fetch('/api/notifications', { method: 'PUT' })
    if (!r.ok) return
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }
  const deleteOne = async (id: string) => {
    const r = await fetch('/api/notifications?id=' + id, { method: 'DELETE' })
    if (!r.ok) return
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const unreadCount = notifications.filter((n) => !n.read).length
  const filtered = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Notifications' }]}>
      <PageHeader
        title="Notifications"
        subtitle="All your alerts and updates in one place"
        actions={
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" iconLeft={<Check className="h-4 w-4" />} onClick={markAllRead}>
                Mark all read
              </Button>
            )}
          </div>
        }
      />

      <div className="flex gap-2 mb-4">
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-blue-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f === 'all' ? 'All' : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
          </button>
        ))}
      </div>

      <Card>
        {isLoading ? (
          <SkeletonTable rows={6} columns={1} />
        ) : filtered.length === 0 ? (
          <EmptyState
            type="data"
            title={filter === 'unread' ? 'All caught up!' : 'No notifications'}
            description={filter === 'unread' ? 'You have no unread notifications' : 'Notifications will appear here'}
          />
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map((n) => (
              <div
                key={n.id}
                className={`flex gap-3 p-4 hover:bg-slate-50 transition-colors group ${!n.read ? 'bg-blue-50/30' : ''}`}
              >
                <div className="mt-0.5 shrink-0">{typeIcon[n.type] ?? <Info className="h-5 w-5 text-slate-400" />}</div>
                <div
                  className="flex-1 min-w-0"
                  onClick={() => !n.read && markRead([n.id])}
                  style={{ cursor: !n.read ? 'pointer' : 'default' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium ${!n.read ? 'text-slate-900' : 'text-slate-600'}`}>{n.title}</p>
                    <span className="text-xs text-slate-400 shrink-0">{fmtTime(n.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">{n.message}</p>
                  {!n.read && (
                    <button
                      onClick={() => markRead([n.id])}
                      className="mt-1.5 text-xs text-blue-600 hover:text-blue-700"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
                <button
                  onClick={() => deleteOne(n.id)}
                  className="shrink-0 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        {hasMore && (
          <div className="p-4 text-center border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => cursor && load(cursor)}>
              Load more
            </Button>
          </div>
        )}
      </Card>
    </DashboardLayout>
  )
}
