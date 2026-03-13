import { useState, useEffect, useRef, useMemo } from 'react'
import { 
  Search, X, Truck, Package, Users, Wrench, FileText, 
  MapPin, Calendar, BarChart, Settings, LogOut,
  ChevronRight, Sparkles, Clock, Star
} from 'lucide-react'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'

interface Command {
  id: string
  title: string
  subtitle?: string
  icon: React.ReactNode
  shortcut?: string
  action: () => void
  category: string
  keywords?: string[]
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onAddVehicle?: () => void
  onAddDelivery?: () => void
  onAddClient?: () => void
  onAddMaintenance?: () => void
}

export default function CommandPalette({ 
  isOpen, 
  onClose,
  onAddVehicle,
  onAddDelivery,
  onAddClient,
  onAddMaintenance
}: CommandPaletteProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentCommands, setRecentCommands] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const userRole = session?.user?.role || 'viewer'

  // Define all available commands
  const commands: Command[] = useMemo(() => [
    // Navigation
    {
      id: 'go-dashboard',
      title: 'Go to Dashboard',
      subtitle: 'View fleet overview',
      icon: <BarChart className="h-5 w-5" />,
      shortcut: 'G D',
      action: () => { router.push('/'); onClose() },
      category: 'Navigation',
      keywords: ['home', 'overview', 'main']
    },
    {
      id: 'go-vehicles',
      title: 'Go to Vehicles',
      subtitle: 'Manage fleet vehicles',
      icon: <Truck className="h-5 w-5" />,
      shortcut: 'G V',
      action: () => { router.push('/?tab=vehicles'); onClose() },
      category: 'Navigation',
      keywords: ['trucks', 'cars', 'fleet']
    },
    {
      id: 'go-deliveries',
      title: 'Go to Deliveries',
      subtitle: 'Track all deliveries',
      icon: <Package className="h-5 w-5" />,
      shortcut: 'G L',
      action: () => { router.push('/?tab=deliveries'); onClose() },
      category: 'Navigation',
      keywords: ['shipments', 'orders', 'packages']
    },
    {
      id: 'go-clients',
      title: 'Go to Clients',
      subtitle: 'Manage customer database',
      icon: <Users className="h-5 w-5" />,
      shortcut: 'G C',
      action: () => { router.push('/?tab=clients'); onClose() },
      category: 'Navigation',
      keywords: ['customers', 'businesses']
    },
    {
      id: 'go-maintenance',
      title: 'Go to Maintenance',
      subtitle: 'View maintenance tasks',
      icon: <Wrench className="h-5 w-5" />,
      shortcut: 'G M',
      action: () => { router.push('/?tab=maintenance'); onClose() },
      category: 'Navigation',
      keywords: ['repairs', 'service', 'tasks']
    },
    {
      id: 'go-reports',
      title: 'Go to Reports',
      subtitle: 'View analytics and reports',
      icon: <BarChart className="h-5 w-5" />,
      shortcut: 'G R',
      action: () => { router.push('/?tab=reports'); onClose() },
      category: 'Navigation',
      keywords: ['analytics', 'stats', 'data']
    },
    // Actions
    ...(onAddVehicle ? [{
      id: 'add-vehicle',
      title: 'Add New Vehicle',
      subtitle: 'Add a vehicle to the fleet',
      icon: <Truck className="h-5 w-5" />,
      shortcut: 'A V',
      action: () => { onAddVehicle(); onClose() },
      category: 'Actions',
      keywords: ['create', 'new', 'truck', 'car']
    }] : []),
    ...(onAddDelivery ? [{
      id: 'add-delivery',
      title: 'Add New Delivery',
      subtitle: 'Create a new delivery',
      icon: <Package className="h-5 w-5" />,
      shortcut: 'A D',
      action: () => { onAddDelivery(); onClose() },
      category: 'Actions',
      keywords: ['create', 'new', 'order', 'shipment']
    }] : []),
    ...(onAddClient ? [{
      id: 'add-client',
      title: 'Add New Client',
      subtitle: 'Add a customer to the database',
      icon: <Users className="h-5 w-5" />,
      shortcut: 'A C',
      action: () => { onAddClient(); onClose() },
      category: 'Actions',
      keywords: ['create', 'new', 'customer', 'business']
    }] : []),
    ...(onAddMaintenance ? [{
      id: 'add-maintenance',
      title: 'Add Maintenance Task',
      subtitle: 'Schedule vehicle maintenance',
      icon: <Wrench className="h-5 w-5" />,
      shortcut: 'A M',
      action: () => { onAddMaintenance(); onClose() },
      category: 'Actions',
      keywords: ['create', 'new', 'repair', 'service']
    }] : []),
    // Admin
    ...(userRole === 'admin' ? [{
      id: 'admin-users',
      title: 'User Management',
      subtitle: 'Manage users and roles',
      icon: <Users className="h-5 w-5" />,
      shortcut: 'A U',
      action: () => { router.push('/admin/users'); onClose() },
      category: 'Admin',
      keywords: ['users', 'roles', 'permissions']
    }] : []),
    // Tools
    {
      id: 'toggle-theme',
      title: 'Toggle Theme',
      subtitle: 'Switch between light and dark mode',
      icon: <Sparkles className="h-5 w-5" />,
      shortcut: 'T T',
      action: () => { 
        document.documentElement.classList.toggle('dark')
        onClose() 
      },
      category: 'Tools',
      keywords: ['dark mode', 'light mode', 'theme']
    }
  ], [router, onClose, onAddVehicle, onAddDelivery, onAddClient, onAddMaintenance, userRole])

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query) {
      // Show recent commands first, then all
      const recent = recentCommands
        .map(id => commands.find(c => c.id === id))
        .filter(Boolean) as Command[]
      
      const others = commands.filter(c => !recentCommands.includes(c.id))
      return [...recent, ...others]
    }

    const lowerQuery = query.toLowerCase()
    return commands.filter(cmd => 
      cmd.title.toLowerCase().includes(lowerQuery) ||
      cmd.subtitle?.toLowerCase().includes(lowerQuery) ||
      cmd.keywords?.some(k => k.toLowerCase().includes(lowerQuery)) ||
      cmd.category.toLowerCase().includes(lowerQuery)
    )
  }, [commands, query, recentCommands])

  // Group by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {}
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) groups[cmd.category] = []
      groups[cmd.category].push(cmd)
    })
    return groups
  }, [filteredCommands])

  // Handle command execution
  const executeCommand = (command: Command) => {
    // Track recent command
    setRecentCommands(prev => {
      const updated = [command.id, ...prev.filter(id => id !== command.id)].slice(0, 5)
      localStorage.setItem('commandPalette_recent', JSON.stringify(updated))
      return updated
    })
    
    command.action()
  }

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Close on escape
      if (e.key === 'Escape') {
        onClose()
        return
      }

      // Navigate with arrow keys
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const command = filteredCommands[selectedIndex]
        if (command) executeCommand(command)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredCommands, selectedIndex, onClose])

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      inputRef.current?.focus()
      
      // Load recent commands
      const saved = localStorage.getItem('commandPalette_recent')
      if (saved) {
        try {
          setRecentCommands(JSON.parse(saved))
        } catch {}
      }
    }
  }, [isOpen])

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.children[selectedIndex]
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  if (!isOpen) return null

  let commandIndex = 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-4 border-b">
          <Search className="h-6 w-6 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands, pages, or actions..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            className="flex-1 text-lg text-gray-900 placeholder-gray-400 outline-none bg-transparent"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          )}
          <kbd className="hidden sm:block px-2 py-1 text-xs text-gray-500 bg-gray-100 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div 
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto py-2"
        >
          {filteredCommands.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Search className="h-12 w-12 mb-3 opacity-30" />
              <p>No commands found for "{query}"</p>
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, cmds]) => (
              <div key={category}>
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {category}
                </div>
                {cmds.map((command) => {
                  const isSelected = commandIndex === selectedIndex
                  const currentIndex = commandIndex++
                  
                  return (
                    <button
                      key={command.id}
                      onClick={() => executeCommand(command)}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${
                        isSelected ? 'bg-primary-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${
                        isSelected ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {command.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium ${
                          isSelected ? 'text-primary-900' : 'text-gray-900'
                        }`}>
                          {command.title}
                        </div>
                        {command.subtitle && (
                          <div className="text-sm text-gray-500 truncate">
                            {command.subtitle}
                          </div>
                        )}
                      </div>
                      {command.shortcut && (
                        <div className="hidden sm:flex items-center gap-1">
                          {command.shortcut.split(' ').map((key, i) => (
                            <kbd 
                              key={i}
                              className={`px-2 py-1 text-xs rounded ${
                                isSelected 
                                  ? 'bg-primary-200 text-primary-800' 
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {key}
                            </kbd>
                          ))}
                        </div>
                      )}
                      <ChevronRight className={`h-5 w-5 transition ${
                        isSelected ? 'text-primary-600 opacity-100' : 'text-gray-400 opacity-0'
                      }`} />
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white rounded border">↑↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white rounded border">↵</kbd>
              <span>to select</span>
            </span>
          </div>
          <span>{filteredCommands.length} commands available</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.15s ease-out;
        }
      `}</style>
    </div>
  )
}
