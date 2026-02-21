import { useState } from 'react'
import { Menu, X, Truck, MapPin, Package, FileVideo, Wrench, BarChart } from 'lucide-react'

interface MobileMenuProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

export default function MobileMenu({ activeTab, setActiveTab }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Truck },
    { id: 'vehicles', label: 'Vehicles', icon: Truck },
    { id: 'deliveries', label: 'Deliveries', icon: Package },
    { id: 'sops', label: 'SOPs', icon: FileVideo },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    { id: 'reports', label: 'Reports', icon: BarChart },
  ]

  return (
    <div className="lg:hidden">
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Mobile menu overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setIsOpen(false)}>
          <div 
            className="absolute right-0 top-0 h-full w-64 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary-600 rounded-lg">
                  <Truck className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">FleetFlow Pro</h2>
                  <p className="text-xs text-gray-600">Mobile Menu</p>
                </div>
              </div>
            </div>

            <nav className="p-4">
              <ul className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <li key={tab.id}>
                      <button
                        onClick={() => {
                          setActiveTab(tab.id)
                          setIsOpen(false)
                        }}
                        className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${
                          activeTab === tab.id 
                            ? 'bg-primary-50 text-primary-600 border border-primary-200' 
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="font-medium">{tab.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>

              <div className="mt-8 pt-6 border-t">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Quick Actions
                </h3>
                <div className="space-y-2">
                  <button className="w-full flex items-center justify-center space-x-2 p-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">
                    <MapPin className="h-5 w-5" />
                    <span>Track Vehicle</span>
                  </button>
                  <button className="w-full flex items-center justify-center space-x-2 p-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
                    <FileVideo className="h-5 w-5" />
                    <span>View SOPs</span>
                  </button>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t">
                <button className="w-full text-sm text-gray-600 hover:text-gray-900 flex items-center justify-center space-x-2 p-2">
                  <span>Settings</span>
                </button>
                <button className="w-full text-sm text-gray-600 hover:text-gray-900 flex items-center justify-center space-x-2 p-2">
                  <span>Help & Support</span>
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}
    </div>
  )
}