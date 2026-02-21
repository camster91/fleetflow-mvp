import { useState, useEffect, useRef } from 'react'
import { 
  Truck, MapPin, Package, Calendar, AlertTriangle, 
  CheckCircle, Clock, Users, BarChart, Battery,
  Navigation, FileVideo, Image, Map, Wrench,
  MessageSquare, Download, Upload, Settings, Bell,
  Search, Menu, X, ChevronRight, Filter, SortAsc,
  Phone, Mail, Map as MapIcon, FileText, Home as HomeIcon
} from 'lucide-react'
import AnnouncementModal from '../components/AnnouncementModal'
import VehicleDetailModal from '../components/VehicleDetailModal'
import MobileMenu from '../components/MobileMenu'



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
  { name: 'Delivery Procedures', count: 12, icon: Package },
  { name: 'Vehicle Maintenance', count: 8, icon: Wrench },
  { name: 'Safety Protocols', count: 6, icon: AlertTriangle },
  { name: 'Customer Service', count: 10, icon: Users },
]

export default function Home() {
  const [activeTab, setActiveTab] = useState('overview')
  const [isLoading, setIsLoading] = useState(true)
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false)
  const [isVehicleDetailModalOpen, setIsVehicleDetailModalOpen] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null)
  const [vehicleFilter, setVehicleFilter] = useState('all')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  // Close filter dropdown when clicking outside
  useEffect(() => {
    if (!isFilterOpen) return
    
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isFilterOpen, filterRef])

  // Filter vehicles based on selected filter
  const filteredVehicles = vehicles.filter(vehicle => {
    if (vehicleFilter === 'all') return true
    return vehicle.status === vehicleFilter
  })

  const stats = [
    { label: 'Active Vehicles', value: '3', icon: Truck, color: 'text-green-600', bgColor: 'bg-green-100', change: '+1' },
    { label: 'Today\'s Deliveries', value: '8', icon: Package, color: 'text-blue-600', bgColor: 'bg-blue-100', change: '+2' },
    { label: 'Pending SOPs', value: '5', icon: FileVideo, color: 'text-purple-600', bgColor: 'bg-purple-100', change: '-1' },
    { label: 'Maintenance Due', value: '2', icon: AlertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-100', change: '+1' },
  ]

  const handleQuickAction = (action: string) => {
    alert(`Action: ${action}`)
  }

  const handleOpenAnnouncementModal = () => {
    setIsAnnouncementModalOpen(true)
  }

  const handleCloseAnnouncementModal = () => {
    setIsAnnouncementModalOpen(false)
  }

  const handleSendAnnouncement = (message: string, priority: string, recipients: string) => {
    alert(`Announcement sent!\nMessage: ${message}\nPriority: ${priority}\nRecipients: ${recipients}`)
    setIsAnnouncementModalOpen(false)
  }

  const handleOpenVehicleDetailModal = (vehicle: any) => {
    setSelectedVehicle(vehicle)
    setIsVehicleDetailModalOpen(true)
  }

  const handleCloseVehicleDetailModal = () => {
    setIsVehicleDetailModalOpen(false)
    setSelectedVehicle(null)
  }

  const handleHelpSupport = () => {
    alert('FleetFlow Pro Support\n\nEmail: support@fleetflow.com\nPhone: 1-800-FLEETFLOW\nHours: Mon-Fri 8am-6pm EST\n\nVisit our documentation: docs.fleetflow.com')
  }

  const handleSettings = () => {
    alert('Settings feature coming soon!\n\nYou\'ll be able to customize:\n• Dashboard preferences\n• Notification settings\n• User permissions\n• Integration settings')
  }

  const handleGoogleMapsDemo = () => {
    const demoAddress = '1600+Amphitheatre+Parkway,+Mountain+View,+CA'
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${demoAddress}&travelmode=driving`
    alert(`Opening Google Maps demo with navigation to:\n\nGoogle Headquarters\n1600 Amphitheatre Parkway\nMountain View, CA\n\nNote: In a production app, this would integrate with real vehicle GPS data.`)
    // In a real app, we would window.open(mapsUrl, '_blank')
    // For demo purposes, we'll just show the alert
  }

  const handleUploadSOP = () => {
    alert('SOP Upload Demo\n\nIn a production app, this would:\n1. Open file picker for PDF/Word/Video files\n2. Upload to cloud storage\n3. Parse and categorize content\n4. Notify relevant team members\n\nFor now, try the "SOP Library" section to view existing procedures.')
  }

  const handlePlanRoute = () => {
    alert('Route Planning Demo\n\nThis feature would integrate with:\n• Google Maps API for optimal routing\n• Real-time traffic data\n• Delivery time windows\n• Vehicle capacity constraints\n\nTry the "Google Maps Integration" demo above for navigation.')
  }

  const handleNotifyDrivers = () => {
    setIsAnnouncementModalOpen(true)
  }

  const handleViewReports = () => {
    setActiveTab('reports')
    alert('Reports Dashboard\n\nSwitching to Reports tab. In production, you would see:\n• Delivery performance metrics\n• Vehicle utilization reports\n• Driver safety scores\n• Maintenance cost analysis\n• Custom report builder')
  }

  const handleExploreDemoData = () => {
    alert(`Loading demo data for ${activeTab}...\n\nThis would load sample data including:\n• Mock ${activeTab} entries\n• Sample reports and analytics\n• Interactive charts and visualizations\n• Historical data for testing\n\nTry clicking on individual items to see detailed views.`)
  }

  const handleViewDocumentation = () => {
    alert('FleetFlow Pro Documentation\n\nAccess our comprehensive guides:\n• User Manual: docs.fleetflow.com/user\n• API Reference: docs.fleetflow.com/api\n• Integration Guide: docs.fleetflow.com/integrate\n• Troubleshooting: docs.fleetflow.com/help\n\nContact support for personalized training.')
  }

  const handleCallDriver = (driverName: string) => {
    alert(`Calling ${driverName}...\n\nIn a production app, this would:\n• Dial the driver's registered phone number\n• Log the call for compliance\n• Record call duration and purpose\n• Update driver communication history\n\nPhone: +1 (555) 123-4567`)
  }

  const handleNavigateToAddress = (address: string) => {
    alert(`Navigating to ${address}\n\nThis would open Google Maps with:\n• Turn-by-turn navigation\n• Real-time traffic updates\n• Estimated arrival time\n• Delivery instructions\n\nTry the "Google Maps Integration" demo for a navigation example.`)
  }

  const handleTrackDelivery = (customer: string) => {
    alert(`Tracking delivery to ${customer}\n\nOpening real-time tracking view with:\n• Live vehicle location\n• Delivery progress\n• Customer contact info\n• Delivery notes\n• Photo proof of delivery\n\nSwitching to Deliveries tab for detailed view.`)
    setActiveTab('deliveries')
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
      {/* Header - Mobile Optimized */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3">
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
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Right: Actions and Notifications */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Mobile Search Button */}
              <button 
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 touch-target"
                onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
              >
                <Search className="h-5 w-5 text-gray-600" />
              </button>

              {/* Notifications */}
              <div className="relative">
                <button className="p-2 rounded-lg hover:bg-gray-100 relative touch-target">
                  <Bell className="h-5 w-5 text-gray-600" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
              </div>

              {/* Announcement Button */}
              <button 
                onClick={handleOpenAnnouncementModal}
                className="hidden sm:flex items-center space-x-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium touch-target"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Announce</span>
              </button>

              {/* Mobile Announcement Button */}
              <button 
                onClick={handleOpenAnnouncementModal}
                className="sm:hidden p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 touch-target"
              >
                <MessageSquare className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Mobile Search - Shows when searching */}
          {isMobileSearchOpen && (
            <div className="mt-3 md:hidden">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  autoFocus
                />
                <button 
                  onClick={() => setIsMobileSearchOpen(false)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Navigation Tabs - Responsive */}
          <nav className="mt-4 overflow-x-auto scroll-container">
            <div className="flex space-x-1 sm:space-x-6 min-w-max pb-1">
              {['overview', 'vehicles', 'deliveries', 'sops', 'maintenance', 'reports'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-2 rounded-lg font-medium text-sm transition whitespace-nowrap touch-target ${
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

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        {/* Stats Overview - Responsive Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm p-4 sm:p-6 card-hover">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">{stat.label}</p>
                  <div className="flex items-baseline space-x-2 mt-1">
                    <p className="text-xl sm:text-3xl font-bold text-gray-900">{stat.value}</p>
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
                  <stat.icon className={`h-4 w-4 sm:h-6 sm:w-6 ${stat.color}`} />
                </div>
              </div>
              <div className="mt-4">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full ${stat.bgColor.replace('bg-', 'bg-').replace('100', '500')} rounded-full`} style={{ width: '75%' }}></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8 ${activeTab !== 'overview' ? 'hidden' : ''}`}>
          {/* Left Column - Vehicles & SOPs */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-8">
            {/* Vehicle Status */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 sm:p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">Vehicle Status</h2>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => setActiveTab('vehicles')}
                      className="text-xs sm:text-sm text-primary-600 hover:text-primary-700 font-medium touch-target"
                    >
                      View All
                    </button>
                    <button 
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 touch-target relative"
                    >
                      <Filter className="h-4 w-4 text-gray-500" />
                      {isFilterOpen && (
                        <div ref={filterRef} className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border z-10">
                          <div className="p-3">
                            <h4 className="font-medium text-gray-900 mb-2">Filter Vehicles</h4>
                            {['all', 'active', 'inactive', 'delayed'].map((status) => (
                              <label key={status} className="flex items-center space-x-2 mb-2">
                                <input
                                  type="radio"
                                  name="vehicleFilter"
                                  checked={vehicleFilter === status}
                                  onChange={() => setVehicleFilter(status)}
                                  className="h-4 w-4 text-primary-600"
                                />
                                <span className="text-sm text-gray-700 capitalize">{status}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <div className="divide-y">
                {filteredVehicles.map((vehicle) => (
                  <div 
                    key={vehicle.id} 
                    className="p-4 sm:p-6 hover:bg-gray-50 transition active:bg-gray-100 touch-target"
                    onClick={() => handleOpenVehicleDetailModal(vehicle)}
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
                          handleOpenVehicleDetailModal(vehicle)
                        }}
                        className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition self-end sm:self-auto touch-target"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SOP Categories */}
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
                        className="border rounded-lg p-4 hover:border-primary-300 transition cursor-pointer card-hover active:scale-[0.98] touch-target"
                        onClick={() => handleQuickAction(`View ${category.name}`)}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-primary-50 rounded-lg">
                            <Icon className="h-5 w-5 text-primary-600" />
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
                            className="flex-1 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition flex items-center justify-center space-x-1 touch-target"
                          >
                            <FileVideo className="h-3 w-3" />
                            <span>Videos</span>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleQuickAction(`View ${category.name} Images`)
                            }}
                            className="flex-1 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition flex items-center justify-center space-x-1 touch-target"
                          >
                            <Image className="h-3 w-3" />
                            <span>Images</span>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleQuickAction(`Download ${category.name} PDFs`)
                            }}
                            className="flex-1 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition flex items-center justify-center space-x-1 touch-target"
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
                        onClick={handleGoogleMapsDemo}
                        className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium touch-target"
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
          <div className="space-y-4 sm:space-y-8">
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
                    className="p-4 sm:p-6 hover:bg-gray-50 transition touch-target"
                    onClick={() => handleTrackDelivery(delivery.customer)}
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
                          handleCallDriver(delivery.driver)
                        }}
                        className="flex-1 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition flex items-center justify-center space-x-1 touch-target"
                      >
                        <Phone className="h-3 w-3" />
                        <span>Call Driver</span>
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          handleNavigateToAddress(delivery.address)
                        }}
                        className="flex-1 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition flex items-center justify-center space-x-1 touch-target"
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
                      className="border rounded-lg p-4 hover:border-orange-300 transition touch-target"
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
                          className="px-3 py-1.5 text-sm font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition touch-target"
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

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handleUploadSOP}
                  className="p-3 border rounded-lg hover:border-primary-300 hover:bg-primary-50 transition active:scale-95 flex flex-col items-center justify-center touch-target"
                >
                  <Upload className="h-5 w-5 text-primary-600 mb-2" />
                  <span className="text-sm font-medium text-gray-900">Upload SOP</span>
                </button>
                <button 
                  onClick={handlePlanRoute}
                  className="p-3 border rounded-lg hover:border-primary-300 hover:bg-primary-50 transition active:scale-95 flex flex-col items-center justify-center touch-target"
                >
                  <MapIcon className="h-5 w-5 text-primary-600 mb-2" />
                  <span className="text-sm font-medium text-gray-900">Plan Route</span>
                </button>
                <button 
                  onClick={handleNotifyDrivers}
                  className="p-3 border rounded-lg hover:border-primary-300 hover:bg-primary-50 transition active:scale-95 flex flex-col items-center justify-center touch-target"
                >
                  <MessageSquare className="h-5 w-5 text-primary-600 mb-2" />
                  <span className="text-sm font-medium text-gray-900">Notify</span>
                </button>
                <button 
                  onClick={handleViewReports}
                  className="p-3 border rounded-lg hover:border-primary-300 hover:bg-primary-50 transition active:scale-95 flex flex-col items-center justify-center touch-target"
                >
                  <BarChart className="h-5 w-5 text-primary-600 mb-2" />
                  <span className="text-sm font-medium text-gray-900">Reports</span>
                </button>
              </div>

              {/* Help Section */}
              <div className="mt-6 pt-6 border-t">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Need Help?</h4>
                <div className="space-y-2">
                  <button 
                    onClick={handleHelpSupport}
                    className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition flex items-center justify-between touch-target"
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
                    onClick={handleViewDocumentation}
                    className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition flex items-center justify-between touch-target"
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
      {activeTab !== 'overview' && (
        <div className="bg-white rounded-xl shadow-sm p-8 my-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Management</h2>
          <p className="text-gray-600 mb-4">This feature is under development. Here you'll be able to manage {activeTab}.</p>
          <div className="flex space-x-4">
            <button 
              onClick={handleExploreDemoData}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
            >
              Explore Demo Data
            </button>
            <button 
              onClick={handleViewDocumentation}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              View Documentation
            </button>
          </div>
        </div>
      )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <div className="text-sm text-gray-600 text-center sm:text-left">
              <p>© 2026 FleetFlow Pro. MVP Demonstration.</p>
              <p className="mt-1">Built for Joseph's Food Truck Delivery Service</p>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={handleSettings}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-1 touch-target"
              >
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </button>
              <button 
                onClick={handleHelpSupport}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium touch-target"
              >
                Help & Support
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
        <div className="flex items-center justify-around py-2 px-4">
          {[
            { icon: HomeIcon, label: 'Home', id: 'overview' },
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
                className="flex flex-col items-center space-y-1 p-2 touch-target"
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

      {/* Modals */}
      <AnnouncementModal
        isOpen={isAnnouncementModalOpen}
        onClose={handleCloseAnnouncementModal}
        onSend={handleSendAnnouncement}
      />
      <VehicleDetailModal
        isOpen={isVehicleDetailModalOpen}
        onClose={handleCloseVehicleDetailModal}
        vehicle={selectedVehicle}
      />

      {/* Global Styles for Mobile Optimization */}
      <style jsx global>{`
        /* Mobile-first responsive utilities */
        @media (max-width: 640px) {
          /* Larger touch targets */
          .touch-target {
            min-height: 44px;
            min-width: 44px;
          }
          
          /* Card hover effect for mobile */
          .card-hover:active {
            transform: scale(0.98);
            transition: transform 0.1s ease;
          }
        }

        /* Better scrolling on mobile */
        .scroll-container {
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none; /* Firefox */
        }
        
        .scroll-container::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Edge */
        }

        /* Prevent text selection on tap */
        button, [role="button"] {
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
        }
      `}</style>
    </div>
  )
}