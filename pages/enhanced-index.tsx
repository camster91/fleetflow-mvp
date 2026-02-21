import { useState, useEffect } from 'react'
import { 
  Truck, MapPin, Package, Calendar, AlertTriangle, 
  CheckCircle, Clock, Users, BarChart, Battery,
  Navigation, FileVideo, Image, Map, Wrench,
  MessageSquare, Download, Upload, Settings, Bell,
  Search, Menu, X, ChevronRight, Filter, SortAsc,
  Phone, Mail, Map as MapIcon, FileText, Home
} from 'lucide-react'
import MobileMenu from '../components/MobileMenu'
import AnnouncementModal from '../components/AnnouncementModal'
import VehicleDetailModal from '../components/VehicleDetailModal'

// Mock data for the MVP
const vehicles = [
  { id: 1, name: 'Food Truck 1', status: 'active', driver: 'John D.', location: 'Downtown', eta: '10 min', mileage: 45230, maintenanceDue: false },
  { id: 2, name: 'Van 2', status: 'active', driver: 'Sarah M.', location: 'East Side', eta: '25 min', mileage: 38920, maintenanceDue: true },
  { id: 3, name: 'Truck 3', status: 'inactive', driver: 'Mike R.', location: 'Depot', eta: 'N/A', mileage: 51200, maintenanceDue: false },
  { id: 4, name: 'Van 4', status: 'delayed', driver: 'Alex T.', location: 'West End', eta: '45 min', mileage: 42100, maintenanceDue: true },
]

const deliveries = [
  { id: 1, address: '123 Main St', customer: 'Restaurant A', status: 'in-transit', driver: 'John D.', items: 15, progress: 65 },
  { id: 2, address: '456 Oak Ave', customer: 'Cafe B', status: 'pending', driver: 'Sarah M.', items: 8, progress: 0 },
  { id: 3, address: '789 Pine Rd', customer: 'Hotel C', status: 'delivered', driver: 'Mike R.', items: 22, progress: 100 },
  { id: 4, address: '321 Elm St', customer: 'Office D', status: 'in-transit', driver: 'Alex T.', items: 12, progress: 30 },
]

const maintenanceTasks = [
  { id: 1, vehicle: 'Van 2', type: 'Oil Change', dueDate: '2026-02-25', priority: 'high' },
  { id: 2, vehicle: 'Van 4', type: 'Brake Inspection', dueDate: '2026-02-28', priority: 'medium' },
  { id: 3, vehicle: 'Food Truck 1', type: 'Tire Rotation', dueDate: '2026-03-05', priority: 'low' },
]

const sopCategories = [
  { name: 'Delivery Procedures', count: 12, icon: Package, color: 'bg-blue-100 text-blue-600' },
  { name: 'Vehicle Maintenance', count: 8, icon: Wrench, color: 'bg-green-100 text-green-600' },
  { name: 'Safety Protocols', count: 6, icon: AlertTriangle, color: 'bg-red-100 text-red-600' },
  { name: 'Customer Service', count: 10, icon: Users, color: 'bg-purple-100 text-purple-600' },
]

export default function EnhancedHome() {
  const [activeTab, setActiveTab] = useState('overview')
  const [isLoading, setIsLoading] = useState(true)
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [notifications, setNotifications] = useState([
    { id: 1, message: 'Van 2 maintenance due', type: 'warning', time: '10 min ago' },
    { id: 2, message: 'Delivery completed to Hotel C', type: 'success', time: '30 min ago' },
    { id: 3, message: 'New SOP uploaded', type: 'info', time: '1 hour ago' },
  ])

  useEffect(() => {
    // Simulate loading data
    const timer = setTimeout(() => setIsLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  const stats = [
    { label: 'Active Vehicles', value: '3', icon: Truck, color: 'text-green-600', bgColor: 'bg-green-100', change: '+1' },
    { label: 'Today\'s Deliveries', value: '8', icon: Package, color: 'text-blue-600', bgColor: 'bg-blue-100', change: '+2' },
    { label: 'Pending SOPs', value: '5', icon: FileVideo, color: 'text-purple-600', bgColor: 'bg-purple-100', change: '-1' },
    { label: 'Maintenance Due', value: '2', icon: AlertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-100', change: '+1' },
  ]

  const handleSendAnnouncement = (message: string, priority: string, recipients: string) => {
    console.log('Sending announcement:', { message, priority, recipients })
    // In a real app, this would call an API
    alert(`Announcement sent to ${recipients} with ${priority} priority!`)
  }

  const handleViewVehicle = (vehicle: any) => {
    setSelectedVehicle(vehicle)
  }

  const handleQuickAction = (action: string) => {
    alert(`Quick action: ${action}`)
    // In a real app, this would trigger specific functionality
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading FleetFlow Dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Announcement Modal */}
      <AnnouncementModal 
        isOpen={isAnnouncementModalOpen}
        onClose={() => setIsAnnouncementModalOpen(false)}
        onSend={handleSendAnnouncement}
      />

      {/* Vehicle Detail Modal */}
      <VehicleDetailModal 
        isOpen={!!selectedVehicle}
        onClose={() => setSelectedVehicle(null)}
        vehicle={selectedVehicle}
      />

      {/* Header - Mobile Optimized */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Logo and Mobile Menu */}
            <div className="flex items-center space-x-3">
              <MobileMenu activeTab={activeTab} setActiveTab={setActiveTab} />
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary-600 rounded-lg">
                  <Truck className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-lg sm:text-xl font-bold text-gray-900">FleetFlow Pro</h1>
                  <p className="text-xs sm:text-sm text-gray-600">Fleet Management</p>
                </div>
              </div>
            </div>

            {/* Center: Search Bar - Hidden on mobile, shown on medium+ */}
            <div className="hidden md:flex flex-1 max-w-md mx-4">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search vehicles, drivers, deliveries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Right: Actions and Notifications */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Mobile Search Button */}
              <button className="md:hidden p-2 rounded-lg hover:bg-gray-100">
                <Search className="h-5 w-5 text-gray-600" />
              </button>

              {/* Notifications */}
              <div className="relative">
                <button className="p-2 rounded-lg hover:bg-gray-100 relative">
                  <Bell className="h-5 w-5 text-gray-600" />
                  {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                </button>
              </div>

              {/* Announcement Button */}
              <button 
                onClick={() => setIsAnnouncementModalOpen(true)}
                className="hidden sm:flex items-center space-x-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Announce</span>
              </button>

              {/* Mobile Announcement Button */}
              <button 
                onClick={() => setIsAnnouncementModalOpen(true)}
                className="sm:hidden p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <MessageSquare className="h-5 w-5" />
              </button>

              {/* User Avatar */}
              <div className="hidden sm:block">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <Users className="h-4 w-4 text-gray-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Search - Shows when searching */}
          {false && (
            <div className="mt-3 md:hidden">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          )}

          {/* Navigation Tabs - Responsive */}
          <nav className="mt-4 overflow-x-auto">
            <div className="flex space-x-1 sm:space-x-6 min-w-max">
              {['overview', 'vehicles', 'deliveries', 'sops', 'maintenance', 'reports'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-2 rounded-lg font-medium text-sm transition whitespace-nowrap ${
                    activeTab === tab 
                      ? 'bg-primary-50 text-primary-600 border border-primary-200' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        {/* Stats Overview - Responsive Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm p-4 card-hover">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">{stat.label}</p>
                  <div className="flex items-baseline space-x-2">
                    <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                    {stat.change && (
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                        stat.change.startsWith('+') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {stat.change}
                      </span>
                    )}
                  </div>
                </div>
                <div className={`p-2 sm:p-3 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                </div>
              </div>
              <div className="mt-3">
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full ${stat.bgColor.replace('bg-', 'bg-').replace('100', '500')} rounded-full`} style={{ width: '75%' }}></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Column - Vehicles & SOPs */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Vehicle Status */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 sm:p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">Vehicle Status</h2>
                  <div className="flex items-center space-x-2">
                    <button className="text-xs sm:text-sm text-primary-600 hover:text-primary-700 font-medium">
                      View All
                    </button>
                    <button className="p-1.5 rounded-lg hover:bg-gray-100">
                      <Filter className="h-4 w-4 text-gray-500" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="divide-y">
                {vehicles.map((vehicle) => (
                  <div 
                    key={vehicle.id} 
                    className="p-4 sm:p-6 hover:bg-gray-50 transition active:bg-gray-100"
                    onClick={() => handleViewVehicle(vehicle)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${vehicle.status === 'active' ? 'bg-green-100 text-green-600' : vehicle.status === 'delayed' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'}`}>
                          <Truck className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{vehicle.name}</h3>
                          <p className="text-sm text-gray-600">{vehicle.driver}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-600">{vehicle.location}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">ETA: {vehicle.eta}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-1">
                          <Battery className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-600">{vehicle.mileage.toLocaleString()} km</span>
                        </div>
                        {vehicle.maintenanceDue && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Maintenance Due
                          </span>
                        )}
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewVehicle(vehicle)
                        }}
                        className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition self-end sm:self-auto"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SOP Categories - Responsive Grid */}
            <div className="bg-white rounded-xl shadow-sm">
              <div className="p-4 sm:p-6 border-b">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">SOP Categories</h2>
                <p className="text-sm text-gray-600 mt-1">Standard Operating Procedures for drivers</p>
              </div>
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {sopCategories.map((category) => {
                    const Icon = category.icon
                    return (
                      <div 
                        key={category.name} 
                        className="border rounded-lg p-4 hover:border-primary-300 transition cursor-pointer card-hover active:scale-[0.98]"
                        onClick={() => handleQuickAction(`View ${category.name}`)}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${category.color.split(' ')[0]} ${category.color.split(' ')[1]}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{category.name}</h3>
                            <p className="text-sm text-gray-600">{category.count} procedures</p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        </div>
                        <div className="mt-4 flex space-x-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleQuickAction(`View ${category.name} Videos`)
                            }}
                            className="flex-1 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition flex items-center justify-center space-x-1"
                          >
                            <FileVideo className="h-3 w-3" />
                            <span>Videos</span>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleQuickAction(`View ${category.name} Images`)
                            }}
                            className="flex-1 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition flex items-center justify-center space-x-1"
                          >
                            <Image className="h-3 w-3" />
                            <span>Images</span>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleQuickAction(`Download ${category.name} PDFs`)
                            }}
                            className="flex-1 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition flex items-center justify-center space-x-1"
                          >
                            <Download className="h-3 w-3" />
                            <span>PDFs</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start space-x-3">
                    <Navigation className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900">Google Maps Integration</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Step-by-step navigation with delivery-specific instructions, parking locations, and contact information.
                      </p>
                      <button 
                        onClick={() => handleQuickAction('Open Google Maps Integration')}
                        className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                      >
                        Try Navigation Demo
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Deliveries & Maintenance */}
          <div className="space-y-4 sm:space-y-6">
            {/* Active Deliveries */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 sm:p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">Active Deliveries</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {deliveries.filter(d => d.status === 'in-transit').length} in progress
                  </span>
                </div>
              </div>
              <div className="divide-y">
                {deliveries.map((delivery) => (
                  <div 
                    key={delivery.id} 
                    className="p-4 sm:p-6 hover:bg-gray-50 transition"
                    onClick={() => handleQuickAction(`Track delivery to ${delivery.customer}`)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-2 sm:space-y-0">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{delivery.customer}</h3>
                        <p className="text-sm text-gray-600 mt-1">{delivery.address}</p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium self-start ${
                        delivery.status === 'delivered' ? 'bg-green-100 text-green-800' : 
                        delivery.status === 'in-transit' ? 'bg-blue-100 text-blue-800' : 
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {delivery.status}
                      </span>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-1">
                            <Users className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">{delivery.driver}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Package className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">{delivery.items} items</span>
                          </div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{delivery.progress}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            delivery.status === 'delivered' ? 'bg-green-500' : 
                            delivery.status === 'in-transit' ? 'bg-blue-500' : 
                            'bg-gray-400'
                          }`}
                          style={{ width: `${delivery.progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex space-x-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          handleQuickAction(`Call ${delivery.driver} about ${delivery.customer}`)
                        }}
                        className="flex-1 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition flex items-center justify-center space-x-1"
                      >
                        <Phone className="h-3 w-3" />
                        <span>Call Driver</span>
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          handleQuickAction(`Navigate to ${delivery.address}`)
                        }}
                        className="flex-1 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition flex items-center justify-center space-x-1"
                      >
                        <Navigation className="h-3 w-3" />
                        <span>Navigate</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Maintenance Schedule */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 sm:p-6 border-b">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Maintenance Schedule</h2>
                <p className="text-sm text-gray-600 mt-1">Preventive maintenance tracking</p>
              </div>
              <div className="p-4 sm:p-6">
                <div className="space-y-3">
                  {maintenanceTasks.map((task) => (
                    <div 
                      key={task.id} 
                      className="border rounded-lg p-4 hover:border-orange-300 transition"
                      onClick={() => handleQuickAction(`Schedule ${task.type} for ${task.vehicle}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{task.vehicle}</h3>
                          <p className="text-sm text-gray-600">{task.type}</p>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          task.priority === 'high' ? 'bg-red-100 text-red-800' : 
                          task.priority === 'medium' ? 'bg-orange-100 text-orange-800' : 
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {task.priority}
                        </span>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-600">Due: {task.dueDate}</span>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            handleQuickAction(`Reschedule ${task.type} for ${task.vehicle}`)
                          }}
                          className="px-3 py-1.5 text-sm font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition"
                        >
                          Schedule
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">GPS Tracking</h4>
                      <p className="text-sm text-gray-600">Integrated with existing vehicle systems</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-gray-600">Live</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions - Enhanced */}
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => handleQuickAction('Upload SOP')}
                  className="p-3 border rounded-lg hover:border-primary-300 hover:bg-primary-50 transition active:scale-95 flex flex-col items-center justify-center"
                >
                  <Upload className="h-5 w-5 text-primary-600 mb-2" />
                  <span className="text-sm font-medium text-gray-900">Upload SOP</span>
                </button>
                <button 
                  onClick={() => handleQuickAction('Plan Route')}
                  className="p-3 border rounded-lg hover:border-primary-300 hover:bg-primary-50 transition active:scale-95 flex flex-col items-center justify-center"
                >
                  <MapIcon className="h-5 w-5 text-primary-600 mb-2" />
                  <span className="text-sm font-medium text-gray-900">Plan Route</span>
                </button>
                <button 
                  onClick={() => setIsAnnouncementModalOpen(true)}
                  className="p-3 border rounded-lg hover:border-primary-300 hover:bg-primary-50 transition active:scale-95 flex flex-col items-center justify-center"
                >
                  <MessageSquare className="h-5 w-5 text-primary-600 mb-2" />
                  <span className="text-sm font-medium text-gray-900">Notify Drivers</span>
                </button>
                <button 
                  onClick={() => handleQuickAction('View Reports')}
                  className="p-3 border rounded-lg hover:border-primary-300 hover:bg-primary-50 transition active:scale-95 flex flex-col items-center justify-center"
                >
                  <BarChart className="h-5 w-5 text-primary-600 mb-2" />
                  <span className="text-sm font-medium text-gray-900">Reports</span>
                </button>
                <button 
                  onClick={() => handleQuickAction('Emergency Alert')}
                  className="p-3 border rounded-lg hover:border-red-300 hover:bg-red-50 transition active:scale-95 flex flex-col items-center justify-center"
                >
                  <AlertTriangle className="h-5 w-5 text-red-600 mb-2" />
                  <span className="text-sm font-medium text-gray-900">Emergency</span>
                </button>
                <button 
                  onClick={() => handleQuickAction('Settings')}
                  className="p-3 border rounded-lg hover:border-gray-300 hover:bg-gray-50 transition active:scale-95 flex flex-col items-center justify-center"
                >
                  <Settings className="h-5 w-5 text-gray-600 mb-2" />
                  <span className="text-sm font-medium text-gray-900">Settings</span>
                </button>
              </div>

              {/* Help & Support Section */}
              <div className="mt-6 pt-6 border-t">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Need Help?</h4>
                <div className="space-y-2">
                  <button 
                    onClick={() => handleQuickAction('Contact Support')}
                    className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <Phone className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Call Support</p>
                        <p className="text-xs text-gray-600">24/7 emergency line</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </button>
                  <button 
                    onClick={() => handleQuickAction('View Documentation')}
                    className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <FileText className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Documentation</p>
                        <p className="text-xs text-gray-600">Guides & tutorials</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
        <div className="flex items-center justify-around py-2 px-4">
          {[
            { icon: Home, label: 'Home', id: 'overview' },
            { icon: Truck, label: 'Vehicles', id: 'vehicles' },
            { icon: Package, label: 'Deliveries', id: 'deliveries' },
            { icon: MapIcon, label: 'Map', id: 'map' },
            { icon: BarChart, label: 'Reports', id: 'reports' },
          ].map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex flex-col items-center space-y-1 p-2"
              >
                <Icon className={`h-5 w-5 ${activeTab === item.id ? 'text-primary-600' : 'text-gray-400'}`} />
                <span className={`text-xs ${activeTab === item.id ? 'text-primary-600 font-medium' : 'text-gray-500'}`}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Global Styles for Mobile Optimization */}
      <style jsx global>{`
        @media (max-width: 640px) {
          /* Larger touch targets */
          button, [role="button"], .clickable {
            min-height: 44px;
            min-width: 44px;
          }
          
          /* Prevent text selection on tap */
          .no-select {
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            user-select: none;
          }
          
          /* Card hover effect for mobile */
          .card-hover:active {
            transform: scale(0.98);
            transition: transform 0.1s ease;
          }
        }

        /* Swipe gestures */
        .swipe-container {
          touch-action: pan-y pinch-zoom;
        }

        /* Better scrolling */
        .scroll-container {
          -webkit-overflow-scrolling: touch;
        }
      `}</style>
    </div>
  )
}