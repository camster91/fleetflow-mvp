import { useState } from 'react'
import { Mail, Bell, Truck, Package, Wrench, Users, Check, AlertTriangle } from 'lucide-react'

interface EmailSettingsProps {
  isOpen: boolean
  onClose: () => void
}

interface NotificationSetting {
  id: string
  category: string
  label: string
  description: string
  email: boolean
  push: boolean
  icon: React.ReactNode
}

const DEFAULT_SETTINGS: NotificationSetting[] = [
  {
    id: 'vehicle_added',
    category: 'Vehicles',
    label: 'New Vehicle Added',
    description: 'When a new vehicle is added to the fleet',
    email: true,
    push: true,
    icon: <Truck className="h-5 w-5" />
  },
  {
    id: 'maintenance_due',
    category: 'Maintenance',
    label: 'Maintenance Due',
    description: 'When a vehicle requires maintenance',
    email: true,
    push: true,
    icon: <Wrench className="h-5 w-5" />
  },
  {
    id: 'maintenance_overdue',
    category: 'Maintenance',
    label: 'Maintenance Overdue',
    description: 'Urgent alerts for overdue maintenance',
    email: true,
    push: true,
    icon: <AlertTriangle className="h-5 w-5" />
  },
  {
    id: 'delivery_assigned',
    category: 'Deliveries',
    label: 'Delivery Assigned',
    description: 'When you are assigned a new delivery',
    email: true,
    push: true,
    icon: <Package className="h-5 w-5" />
  },
  {
    id: 'delivery_status',
    category: 'Deliveries',
    label: 'Delivery Status Updates',
    description: 'Updates on delivery progress',
    email: false,
    push: true,
    icon: <Package className="h-5 w-5" />
  },
  {
    id: 'delivery_completed',
    category: 'Deliveries',
    label: 'Delivery Completed',
    description: 'When a delivery is marked as complete',
    email: true,
    push: true,
    icon: <Check className="h-5 w-5" />
  },
  {
    id: 'announcements',
    category: 'General',
    label: 'Fleet Announcements',
    description: 'Important announcements from administrators',
    email: true,
    push: true,
    icon: <Bell className="h-5 w-5" />
  },
  {
    id: 'daily_report',
    category: 'Reports',
    label: 'Daily Summary',
    description: 'Daily fleet activity summary',
    email: true,
    push: false,
    icon: <Mail className="h-5 w-5" />
  },
  {
    id: 'weekly_report',
    category: 'Reports',
    label: 'Weekly Summary',
    description: 'Weekly performance summary',
    email: true,
    push: false,
    icon: <Mail className="h-5 w-5" />
  }
]

export default function EmailSettings({ isOpen, onClose }: EmailSettingsProps) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  if (!isOpen) return null

  const toggleSetting = (id: string, type: 'email' | 'push') => {
    setSettings(prev => prev.map(setting => 
      setting.id === id 
        ? { ...setting, [type]: !setting[type] }
        : setting
    ))
  }

  const handleSave = async () => {
    setIsSaving(true)
    // In production, save to database
    await new Promise(resolve => setTimeout(resolve, 500))
    setSaveMessage('Settings saved successfully!')
    setIsSaving(false)
    setTimeout(() => setSaveMessage(''), 3000)
  }

  // Group settings by category
  const groupedSettings = settings.reduce((acc, setting) => {
    if (!acc[setting.category]) acc[setting.category] = []
    acc[setting.category].push(setting)
    return acc
  }, {} as Record<string, NotificationSetting[]>)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Notification Settings</h2>
              <p className="text-sm text-gray-500">Manage your email and push notification preferences</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
            {Object.entries(groupedSettings).map(([category, items]) => (
              <div key={category} className="mb-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {category}
                </h3>
                <div className="space-y-3">
                  {items.map(setting => (
                    <div 
                      key={setting.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-white rounded-lg text-gray-600">
                          {setting.icon}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{setting.label}</p>
                          <p className="text-sm text-gray-500">{setting.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {/* Email Toggle */}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <span className="text-sm text-gray-500">Email</span>
                          <button
                            onClick={() => toggleSetting(setting.id, 'email')}
                            className={`relative w-11 h-6 rounded-full transition ${
                              setting.email ? 'bg-primary-600' : 'bg-gray-300'
                            }`}
                          >
                            <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition ${
                              setting.email ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                          </button>
                        </label>
                        
                        {/* Push Toggle */}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <span className="text-sm text-gray-500">Push</span>
                          <button
                            onClick={() => toggleSetting(setting.id, 'push')}
                            className={`relative w-11 h-6 rounded-full transition ${
                              setting.push ? 'bg-primary-600' : 'bg-gray-300'
                            }`}
                          >
                            <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition ${
                              setting.push ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                          </button>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
            <div>
              {saveMessage && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <Check className="h-4 w-4" />
                  {saveMessage}
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Settings'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
