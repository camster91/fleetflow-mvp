import { useState, useEffect } from 'react'
import { 
  Plus, Truck, Package, Users, Wrench, FileText, 
  MapPin, Phone, Search, Zap, TrendingUp, Calendar,
  ChevronRight, X
} from 'lucide-react'
import { useSession } from 'next-auth/react'

interface QuickAction {
  id: string
  label: string
  icon: React.ReactNode
  color: string
  href?: string
  onClick?: () => void
  shortcut?: string
  roles?: string[] // Show only for specific roles
}

interface QuickActionsProps {
  onAddVehicle?: () => void
  onAddDelivery?: () => void
  onAddClient?: () => void
  onAddMaintenance?: () => void
}

export default function QuickActions({ 
  onAddVehicle, 
  onAddDelivery, 
  onAddClient,
  onAddMaintenance
}: QuickActionsProps) {
  const { data: session } = useSession()
  const [isExpanded, setIsExpanded] = useState(false)
  const [recentActions, setRecentActions] = useState<string[]>([])

  const userRole = session?.user?.role || 'viewer'

  const actions: QuickAction[] = [
    {
      id: 'add-vehicle',
      label: 'Add Vehicle',
      icon: <Truck className="h-5 w-5" />,
      color: 'bg-blue-600 hover:bg-blue-700',
      onClick: onAddVehicle,
      shortcut: 'V',
      roles: ['admin', 'fleet_manager']
    },
    {
      id: 'add-delivery',
      label: 'Add Delivery',
      icon: <Package className="h-5 w-5" />,
      color: 'bg-green-600 hover:bg-green-700',
      onClick: onAddDelivery,
      shortcut: 'D',
      roles: ['admin', 'fleet_manager', 'dispatch']
    },
    {
      id: 'add-client',
      label: 'Add Client',
      icon: <Users className="h-5 w-5" />,
      color: 'bg-purple-600 hover:bg-purple-700',
      onClick: onAddClient,
      shortcut: 'C',
      roles: ['admin', 'fleet_manager', 'dispatch']
    },
    {
      id: 'add-maintenance',
      label: 'Add Task',
      icon: <Wrench className="h-5 w-5" />,
      color: 'bg-orange-600 hover:bg-orange-700',
      onClick: onAddMaintenance,
      shortcut: 'M',
      roles: ['admin', 'fleet_manager', 'maintenance']
    },
    {
      id: 'view-map',
      label: 'Live Map',
      icon: <MapPin className="h-5 w-5" />,
      color: 'bg-indigo-600 hover:bg-indigo-700',
      href: '/map',
      shortcut: 'L',
      roles: ['admin', 'fleet_manager', 'dispatch']
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: <TrendingUp className="h-5 w-5" />,
      color: 'bg-pink-600 hover:bg-pink-700',
      href: '/?tab=reports',
      shortcut: 'R'
    }
  ]

  // Filter actions by role
  const allowedActions = actions.filter(action => 
    !action.roles || action.roles.includes(userRole)
  )

  // Track recent actions
  const handleActionClick = (action: QuickAction) => {
    setRecentActions(prev => {
      const updated = [action.id, ...prev.filter(id => id !== action.id)].slice(0, 3)
      localStorage.setItem('quickActions_recent', JSON.stringify(updated))
      return updated
    })
    
    if (action.onClick) {
      action.onClick()
    }
    setIsExpanded(false)
  }

  // Load recent actions on mount
  useEffect(() => {
    const saved = localStorage.getItem('quickActions_recent')
    if (saved) {
      try {
        setRecentActions(JSON.parse(saved))
      } catch {}
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        const action = allowedActions.find(a => a.shortcut === e.key.toUpperCase())
        if (action) {
          e.preventDefault()
          handleActionClick(action)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [allowedActions])

  // Get recent action objects
  const recentActionObjects = recentActions
    .map(id => allowedActions.find(a => a.id === id))
    .filter(Boolean) as QuickAction[]

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {/* Expanded Menu */}
      {isExpanded && (
        <div className="mb-2 space-y-2 animate-slide-up">
          {allowedActions.map((action, index) => (
            <div
              key={action.id}
              className="flex items-center gap-3 group"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <span className="text-sm text-gray-600 font-medium opacity-0 group-hover:opacity-100 transition">
                Alt + {action.shortcut}
              </span>
              {action.href ? (
                <a
                  href={action.href}
                  onClick={() => handleActionClick(action)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-white shadow-lg transition transform hover:scale-105 ${action.color}`}
                >
                  {action.icon}
                  <span className="font-medium">{action.label}</span>
                </a>
              ) : (
                <button
                  onClick={() => handleActionClick(action)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-white shadow-lg transition transform hover:scale-105 ${action.color}`}
                >
                  {action.icon}
                  <span className="font-medium">{action.label}</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Recent Actions (when collapsed) */}
      {!isExpanded && recentActionObjects.length > 0 && (
        <div className="flex gap-2 mb-2">
          {recentActionObjects.map((action) => (
            <button
              key={action.id}
              onClick={() => handleActionClick(action)}
              className={`p-3 rounded-full text-white shadow-lg transition transform hover:scale-110 ${action.color}`}
              title={action.label}
            >
              {action.icon}
            </button>
          ))}
        </div>
      )}

      {/* Main Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 px-4 py-3 rounded-full shadow-xl transition transform hover:scale-105 ${
          isExpanded 
            ? 'bg-gray-800 text-white hover:bg-gray-900' 
            : 'bg-primary-600 text-white hover:bg-primary-700'
        }`}
      >
        {isExpanded ? (
          <>
            <X className="h-5 w-5" />
            <span className="font-medium">Close</span>
          </>
        ) : (
          <>
            <Zap className="h-5 w-5" />
            <span className="font-medium">Quick Actions</span>
            {allowedActions.length > 0 && (
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                Alt
              </span>
            )}
          </>
        )}
      </button>

      <style jsx>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
