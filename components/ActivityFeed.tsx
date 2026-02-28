import { useState, useEffect } from 'react'
import { 
  Truck, Package, Users, Wrench, FileText, 
  Plus, Edit2, Trash2, CheckCircle, AlertTriangle,
  Clock, ChevronDown, Filter
} from 'lucide-react'

interface ActivityItem {
  id: string
  type: 'vehicle' | 'delivery' | 'client' | 'maintenance' | 'sop' | 'user'
  action: 'created' | 'updated' | 'deleted' | 'completed' | 'assigned' | 'status_changed'
  title: string
  description: string
  user: string
  userRole: string
  timestamp: string
  metadata?: Record<string, any>
}

// Mock activity data - in production, fetch from API
const MOCK_ACTIVITIES: ActivityItem[] = [
  {
    id: '1',
    type: 'delivery',
    action: 'completed',
    title: 'Delivery Completed',
    description: 'Delivery to Acme Corporation was marked as delivered',
    user: 'John Driver',
    userRole: 'driver',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString()
  },
  {
    id: '2',
    type: 'vehicle',
    action: 'created',
    title: 'Vehicle Added',
    description: 'New vehicle "Delivery Van 3" was added to the fleet',
    user: 'Sarah Manager',
    userRole: 'fleet_manager',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString()
  },
  {
    id: '3',
    type: 'maintenance',
    action: 'assigned',
    title: 'Maintenance Scheduled',
    description: 'Oil change scheduled for Truck A on March 1st',
    user: 'Mike Maintenance',
    userRole: 'maintenance',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString()
  },
  {
    id: '4',
    type: 'client',
    action: 'updated',
    title: 'Client Updated',
    description: 'XYZ Restaurant contact information was updated',
    user: 'Jane Dispatcher',
    userRole: 'dispatch',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString()
  },
  {
    id: '5',
    type: 'delivery',
    action: 'status_changed',
    title: 'Status Update',
    description: 'Delivery #1234 status changed from "Pending" to "In Transit"',
    user: 'System',
    userRole: 'system',
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString()
  },
  {
    id: '6',
    type: 'user',
    action: 'created',
    title: 'New User',
    description: 'New driver account created for Tom Smith',
    user: 'Admin',
    userRole: 'admin',
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString()
  }
]

const typeConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  vehicle: { 
    icon: <Truck className="h-4 w-4" />, 
    color: 'text-blue-600', 
    bg: 'bg-blue-50' 
  },
  delivery: { 
    icon: <Package className="h-4 w-4" />, 
    color: 'text-green-600', 
    bg: 'bg-green-50' 
  },
  client: { 
    icon: <Users className="h-4 w-4" />, 
    color: 'text-purple-600', 
    bg: 'bg-purple-50' 
  },
  maintenance: { 
    icon: <Wrench className="h-4 w-4" />, 
    color: 'text-orange-600', 
    bg: 'bg-orange-50' 
  },
  sop: { 
    icon: <FileText className="h-4 w-4" />, 
    color: 'text-indigo-600', 
    bg: 'bg-indigo-50' 
  },
  user: { 
    icon: <Users className="h-4 w-4" />, 
    color: 'text-pink-600', 
    bg: 'bg-pink-50' 
  }
}

const actionConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  created: { icon: <Plus className="h-3 w-3" />, label: 'Created', color: 'text-green-600' },
  updated: { icon: <Edit2 className="h-3 w-3" />, label: 'Updated', color: 'text-blue-600' },
  deleted: { icon: <Trash2 className="h-3 w-3" />, label: 'Deleted', color: 'text-red-600' },
  completed: { icon: <CheckCircle className="h-3 w-3" />, label: 'Completed', color: 'text-green-600' },
  assigned: { icon: <Users className="h-3 w-3" />, label: 'Assigned', color: 'text-purple-600' },
  status_changed: { icon: <AlertTriangle className="h-3 w-3" />, label: 'Changed', color: 'text-orange-600' }
}

interface ActivityFeedProps {
  limit?: number
  showFilter?: boolean
}

export default function ActivityFeed({ limit = 10, showFilter = true }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>(MOCK_ACTIVITIES)
  const [filter, setFilter] = useState<string>('all')
  const [expanded, setExpanded] = useState(false)

  const filteredActivities = activities
    .filter(a => filter === 'all' || a.type === filter)
    .slice(0, expanded ? undefined : limit)

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

  const filters = [
    { value: 'all', label: 'All Activity', count: activities.length },
    { value: 'vehicle', label: 'Vehicles', count: activities.filter(a => a.type === 'vehicle').length },
    { value: 'delivery', label: 'Deliveries', count: activities.filter(a => a.type === 'delivery').length },
    { value: 'client', label: 'Clients', count: activities.filter(a => a.type === 'client').length },
    { value: 'maintenance', label: 'Maintenance', count: activities.filter(a => a.type === 'maintenance').length }
  ]

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-500" />
          Recent Activity
        </h3>
        {showFilter && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-sm border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            >
              {filters.map(f => (
                <option key={f.value} value={f.value}>
                  {f.label} ({f.count})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Activity List */}
      <div className="divide-y divide-gray-100">
        {filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Clock className="h-12 w-12 mb-3 opacity-30" />
            <p>No recent activity</p>
          </div>
        ) : (
          filteredActivities.map((activity, index) => {
            const typeStyle = typeConfig[activity.type]
            const actionStyle = actionConfig[activity.action]
            
            return (
              <div 
                key={activity.id}
                className="flex gap-3 px-4 py-3 hover:bg-gray-50 transition"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Icon */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${typeStyle.bg} ${typeStyle.color} flex items-center justify-center`}>
                  {typeStyle.icon}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">
                        {activity.title}
                      </p>
                      <p className="text-sm text-gray-600">
                        {activity.description}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {formatTime(activity.timestamp)}
                    </span>
                  </div>
                  
                  {/* Meta */}
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`inline-flex items-center gap-1 text-xs ${actionStyle.color}`}>
                      {actionStyle.icon}
                      {actionStyle.label}
                    </span>
                    <span className="text-xs text-gray-500">
                      by {activity.user}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                      {activity.userRole}
                    </span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Show More */}
      {activities.length > limit && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-3 text-sm text-primary-600 hover:bg-primary-50 transition flex items-center justify-center gap-1"
        >
          {expanded ? (
            <>
              Show Less
              <ChevronDown className="h-4 w-4 rotate-180" />
            </>
          ) : (
            <>
              Show More ({activities.length - limit} more)
              <ChevronDown className="h-4 w-4" />
            </>
          )}
        </button>
      )}
    </div>
  )
}
