import { useState, useEffect, useCallback } from 'react'
import {
  Truck, Package, Users, Wrench, FileText,
  Plus, Edit2, Trash2, CheckCircle, AlertTriangle,
  Clock, ChevronDown, Filter, RefreshCw,
} from 'lucide-react'
import type { ActivityItem } from '../lib/fleet'

const typeConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  vehicle:     { icon: <Truck className="h-4 w-4" />,       color: 'text-blue-600',   bg: 'bg-blue-50' },
  delivery:    { icon: <Package className="h-4 w-4" />,     color: 'text-green-600',  bg: 'bg-green-50' },
  client:      { icon: <Users className="h-4 w-4" />,       color: 'text-purple-600', bg: 'bg-purple-50' },
  maintenance: { icon: <Wrench className="h-4 w-4" />,      color: 'text-orange-600', bg: 'bg-orange-50' },
  sop:         { icon: <FileText className="h-4 w-4" />,     color: 'text-indigo-600', bg: 'bg-indigo-50' },
  user:        { icon: <Users className="h-4 w-4" />,       color: 'text-pink-600',   bg: 'bg-pink-50' },
}

const actionConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  created:        { icon: <Plus className="h-3 w-3" />,          label: 'Created',  color: 'text-green-600' },
  updated:        { icon: <Edit2 className="h-3 w-3" />,         label: 'Updated',  color: 'text-blue-600' },
  deleted:        { icon: <Trash2 className="h-3 w-3" />,        label: 'Deleted',  color: 'text-red-600' },
  completed:      { icon: <CheckCircle className="h-3 w-3" />,   label: 'Done',     color: 'text-green-600' },
  assigned:       { icon: <Users className="h-3 w-3" />,         label: 'Assigned', color: 'text-purple-600' },
  status_changed: { icon: <AlertTriangle className="h-3 w-3" />, label: 'Changed',  color: 'text-orange-600' },
}

interface ActivityFeedProps {
  limit?: number
  showFilter?: boolean
}

function formatTime(timestamp: string) {
  const diff = Date.now() - new Date(timestamp).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(diff / 3600000)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(diff / 86400000)
  if (d < 7) return `${d}d ago`
  return new Date(timestamp).toLocaleDateString()
}

export default function ActivityFeed({ limit = 10, showFilter = true }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [expanded, setExpanded] = useState(false)

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch(`/api/activity?limit=50`)
      if (res.ok) setActivities(await res.json())
    } catch { /* silent */ }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => { fetchActivities() }, [fetchActivities])

  const filtered = activities
    .filter((a) => filter === 'all' || a.type === filter)
    .slice(0, expanded ? undefined : limit)

  const filters = [
    { value: 'all',         label: 'All',         count: activities.length },
    { value: 'vehicle',     label: 'Vehicles',    count: activities.filter((a) => a.type === 'vehicle').length },
    { value: 'delivery',    label: 'Deliveries',  count: activities.filter((a) => a.type === 'delivery').length },
    { value: 'client',      label: 'Clients',     count: activities.filter((a) => a.type === 'client').length },
    { value: 'maintenance', label: 'Maintenance', count: activities.filter((a) => a.type === 'maintenance').length },
  ]

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-500" />
          Recent Activity
        </h3>
        <div className="flex items-center gap-2">
          {showFilter && (
            <>
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {filters.map((f) => (
                  <option key={f.value} value={f.value}>{f.label} ({f.count})</option>
                ))}
              </select>
            </>
          )}
          <button
            onClick={fetchActivities}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            aria-label="Refresh activity"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading activity…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Clock className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">No activity recorded yet</p>
            <p className="text-xs mt-1">Actions will appear here as you use the app</p>
          </div>
        ) : (
          filtered.map((activity, idx) => {
            const typeStyle = typeConfig[activity.type] ?? typeConfig.user
            const actionStyle = actionConfig[activity.action] ?? actionConfig.updated
            return (
              <div
                key={activity.id}
                className="flex gap-3 px-4 py-3 hover:bg-gray-50 transition"
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${typeStyle.bg} ${typeStyle.color} flex items-center justify-center`}>
                  {typeStyle.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm text-gray-900">{activity.title}</p>
                      <p className="text-sm text-gray-600 mt-0.5">{activity.description}</p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                      {formatTime(activity.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`inline-flex items-center gap-1 text-xs ${actionStyle.color}`}>
                      {actionStyle.icon}
                      {actionStyle.label}
                    </span>
                    <span className="text-xs text-gray-500">by {activity.user}</span>
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                      {activity.userRole}
                    </span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {!isLoading && activities.length > limit && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-3 text-sm text-blue-600 hover:bg-blue-50 transition flex items-center justify-center gap-1"
        >
          {expanded ? 'Show Less' : `Show More (${activities.length - limit} more)`}
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  )
}
