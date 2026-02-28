import { useState, useEffect } from 'react'
import { 
  Keyboard, X, Command, Search, Plus, ArrowUp, 
  ArrowDown, Bell, Zap, CornerDownLeft, LogOut
} from 'lucide-react'

interface Shortcut {
  keys: string[]
  description: string
  category: string
}

const SHORTCUTS: Shortcut[] = [
  // Global
  { keys: ['?'], description: 'Show keyboard shortcuts', category: 'Global' },
  { keys: ['Ctrl', 'K'], description: 'Open command palette', category: 'Global' },
  { keys: ['Ctrl', '/'], description: 'Focus search', category: 'Global' },
  { keys: ['N'], description: 'Open notifications', category: 'Global' },
  { keys: ['Esc'], description: 'Close modal/panel', category: 'Global' },
  
  // Navigation
  { keys: ['G', 'D'], description: 'Go to Dashboard', category: 'Navigation' },
  { keys: ['G', 'V'], description: 'Go to Vehicles', category: 'Navigation' },
  { keys: ['G', 'L'], description: 'Go to Deliveries', category: 'Navigation' },
  { keys: ['G', 'C'], description: 'Go to Clients', category: 'Navigation' },
  { keys: ['G', 'M'], description: 'Go to Maintenance', category: 'Navigation' },
  { keys: ['G', 'R'], description: 'Go to Reports', category: 'Navigation' },
  
  // Quick Actions
  { keys: ['Alt', 'V'], description: 'Add Vehicle', category: 'Actions' },
  { keys: ['Alt', 'D'], description: 'Add Delivery', category: 'Actions' },
  { keys: ['Alt', 'C'], description: 'Add Client', category: 'Actions' },
  { keys: ['Alt', 'M'], description: 'Add Maintenance', category: 'Actions' },
  { keys: ['Alt', 'A'], description: 'Open announcements', category: 'Actions' },
  
  // Lists
  { keys: ['↑', '↓'], description: 'Navigate items', category: 'Lists' },
  { keys: ['Enter'], description: 'Select/Open item', category: 'Lists' },
  { keys: ['Space'], description: 'Toggle/Select', category: 'Lists' },
  
  // Forms
  { keys: ['Ctrl', 'S'], description: 'Save form', category: 'Forms' },
  { keys: ['Ctrl', 'Enter'], description: 'Submit form', category: 'Forms' },
  { keys: ['Tab'], description: 'Next field', category: 'Forms' },
  { keys: ['Shift', 'Tab'], description: 'Previous field', category: 'Forms' }
]

interface KeyboardShortcutsHelpProps {
  isOpen: boolean
  onClose: () => void
}

export default function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // Filter shortcuts based on search
  const filteredShortcuts = searchQuery
    ? SHORTCUTS.filter(s => 
        s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.keys.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : SHORTCUTS

  // Group by category
  const groupedShortcuts = filteredShortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) acc[shortcut.category] = []
    acc[shortcut.category].push(shortcut)
    return acc
  }, {} as Record<string, Shortcut[]>)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Keyboard className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Keyboard Shortcuts</h2>
              <p className="text-sm text-gray-500">Work faster with keyboard commands</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search shortcuts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
              autoFocus
            />
          </div>
        </div>

        {/* Shortcuts List */}
        <div className="max-h-[50vh] overflow-y-auto p-6">
          {Object.keys(groupedShortcuts).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Keyboard className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No shortcuts found for "{searchQuery}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
                <div key={category}>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {shortcuts.map((shortcut, index) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition"
                      >
                        <span className="text-sm text-gray-700">
                          {shortcut.description}
                        </span>
                        <div className="flex items-center gap-1">
                          {shortcut.keys.map((key, keyIndex) => (
                            <span key={keyIndex} className="flex items-center">
                              <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 text-gray-700 rounded border border-gray-200">
                                {key}
                              </kbd>
                              {keyIndex < shortcut.keys.length - 1 && (
                                <span className="mx-1 text-gray-400">+</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t text-sm text-gray-500 flex items-center justify-between">
          <span>Press <kbd className="px-1.5 py-0.5 bg-white rounded border">?</kbd> anytime to show this help</span>
          <span>{SHORTCUTS.length} shortcuts available</span>
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
