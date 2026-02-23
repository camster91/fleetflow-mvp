import { useState, useEffect, useRef } from 'react'
import { 
  Truck, MapPin, Package, Calendar, AlertTriangle, 
  CheckCircle, Clock, Users, BarChart, Battery,
  Navigation, FileVideo, Image, Map, Wrench,
  MessageSquare, Download, Upload, Settings, Bell,
  Search, Menu, X, ChevronRight, Filter, SortAsc,
  Phone, Mail, Map as MapIcon, FileText, Home as HomeIcon, DollarSign
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

  // Data state
  const [vehiclesData, setVehiclesData] = useState(vehicles)
  const [deliveriesData, setDeliveriesData] = useState(deliveries)
  const [maintenanceData, setMaintenanceData] = useState(maintenanceTasks)
  const [sopCategoriesData, setSopCategoriesData] = useState(sopCategories)

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
  const filteredVehicles = vehiclesData.filter(vehicle => {
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

  // Management content renderer
  const renderManagementContent = () => {
    switch (activeTab) {
      case 'vehicles':
        const handleAddVehicle = () => {
          const name = window.prompt('Enter vehicle name:');
          if (!name) return;
          
          const driver = window.prompt('Enter driver name:');
          const location = window.prompt('Enter current location:');
          const mileage = parseInt(window.prompt('Enter mileage:') || '0');
          
          const newVehicle = {
            id: vehiclesData.length > 0 ? Math.max(...vehiclesData.map(v => v.id)) + 1 : 1,
            name,
            status: 'active' as 'active',
            driver: driver || 'Unassigned',
            location: location || 'Depot',
            eta: 'N/A',
            mileage,
            maintenanceDue: false
          };
          
          setVehiclesData([...vehiclesData, newVehicle]);
          alert(`Vehicle "${name}" added successfully!`);
        };

        const handleEditVehicle = (vehicle: any) => {
          const newName = window.prompt('Edit vehicle name:', vehicle.name);
          if (newName === null) return;
          
          const newDriver = window.prompt('Edit driver name:', vehicle.driver);
          const newLocation = window.prompt('Edit location:', vehicle.location);
          const newMileage = window.prompt('Edit mileage:', vehicle.mileage.toString());
          const newStatus = window.prompt('Edit status (active/inactive/delayed):', vehicle.status);
          
          const updatedVehicles = vehiclesData.map(v => 
            v.id === vehicle.id 
              ? {
                  ...v,
                  name: newName || v.name,
                  driver: newDriver || v.driver,
                  location: newLocation || v.location,
                  mileage: newMileage ? parseInt(newMileage) : v.mileage,
                  status: (newStatus === 'active' || newStatus === 'inactive' || newStatus === 'delayed') ? newStatus : v.status
                }
              : v
          );
          
          setVehiclesData(updatedVehicles);
          alert(`Vehicle "${newName || vehicle.name}" updated!`);
        };

        const handleDeleteVehicle = (id: number) => {
          if (window.confirm('Are you sure you want to delete this vehicle? This action cannot be undone.')) {
            setVehiclesData(vehiclesData.filter(v => v.id !== id));
            alert('Vehicle deleted successfully.');
          }
        };

        const handleToggleMaintenance = (id: number) => {
          setVehiclesData(vehiclesData.map(v => 
            v.id === id ? { ...v, maintenanceDue: !v.maintenanceDue } : v
          ));
        };

        return (
          <div className="bg-white rounded-xl shadow-sm p-6 my-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Vehicles Management</h2>
                <p className="text-gray-600 mt-1">Manage your fleet vehicles, drivers, and status</p>
              </div>
              <button
                onClick={handleAddVehicle}
                className="mt-4 md:mt-0 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition flex items-center space-x-2"
              >
                <span>+ Add Vehicle</span>
              </button>
            </div>

            {/* Vehicle Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-600 font-medium">Total Vehicles</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{vehiclesData.length}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-600 font-medium">Active</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{vehiclesData.filter(v => v.status === 'active').length}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-red-600 font-medium">Maintenance Due</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{vehiclesData.filter(v => v.maintenanceDue).length}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-purple-600 font-medium">Average Mileage</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {vehiclesData.length > 0 
                    ? Math.round(vehiclesData.reduce((sum, v) => sum + v.mileage, 0) / vehiclesData.length).toLocaleString()
                    : '0'
                  }
                </p>
              </div>
            </div>

            {/* Vehicles Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mileage</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Maintenance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {vehiclesData.map((vehicle) => (
                    <tr key={vehicle.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="p-2 bg-blue-100 rounded-lg mr-3">
                            <Truck className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{vehicle.name}</p>
                            <p className="text-sm text-gray-600">ETA: {vehicle.eta}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          vehicle.status === 'active' ? 'bg-green-100 text-green-800' :
                          vehicle.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                          'bg-orange-100 text-orange-800'
                        }`}>
                          {vehicle.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-900">{vehicle.driver}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-gray-900">{vehicle.location}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-900">{vehicle.mileage.toLocaleString()} mi</p>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleMaintenance(vehicle.id)}
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            vehicle.maintenanceDue 
                              ? 'bg-red-100 text-red-800 hover:bg-red-200' 
                              : 'bg-green-100 text-green-800 hover:bg-green-200'
                          }`}
                        >
                          {vehicle.maintenanceDue ? 'Due' : 'OK'}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditVehicle(vehicle)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteVehicle(vehicle.id)}
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => {
                              setSelectedVehicle(vehicle);
                              setIsVehicleDetailModalOpen(true);
                            }}
                            className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded"
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing {vehiclesData.length} of {vehiclesData.length} vehicles
                </p>
                <button
                  onClick={() => alert('Exporting vehicles data to CSV...')}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center space-x-2"
                >
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
          </div>
        );
      case 'deliveries':
        const handleAddDelivery = () => {
          const customer = window.prompt('Enter customer name:');
          if (!customer) return;
          
          const address = window.prompt('Enter delivery address:');
          const items = parseInt(window.prompt('Enter number of items:') || '1');
          
          const newDelivery = {
            id: deliveriesData.length > 0 ? Math.max(...deliveriesData.map(d => d.id)) + 1 : 1,
            address: address || 'Unknown',
            customer,
            status: 'pending' as 'pending',
            driver: 'Unassigned',
            items,
            progress: 0
          };
          
          setDeliveriesData([...deliveriesData, newDelivery]);
          alert(`Delivery for "${customer}" added successfully!`);
        };

        const handleEditDelivery = (delivery: any) => {
          const newCustomer = window.prompt('Edit customer name:', delivery.customer);
          if (newCustomer === null) return;
          
          const newAddress = window.prompt('Edit address:', delivery.address);
          const newItems = window.prompt('Edit number of items:', delivery.items.toString());
          const newDriver = window.prompt('Edit driver:', delivery.driver);
          const newStatus = window.prompt('Edit status (pending/in-transit/delivered):', delivery.status);
          
          const updatedDeliveries = deliveriesData.map(d => 
            d.id === delivery.id 
              ? {
                  ...d,
                  customer: newCustomer || d.customer,
                  address: newAddress || d.address,
                  items: newItems ? parseInt(newItems) : d.items,
                  driver: newDriver || d.driver,
                  status: (newStatus === 'pending' || newStatus === 'in-transit' || newStatus === 'delivered') ? newStatus : d.status
                }
              : d
          );
          
          setDeliveriesData(updatedDeliveries);
          alert(`Delivery updated!`);
        };

        const handleDeleteDelivery = (id: number) => {
          if (window.confirm('Are you sure you want to delete this delivery?')) {
            setDeliveriesData(deliveriesData.filter(d => d.id !== id));
            alert('Delivery deleted.');
          }
        };

        const handleAssignDriver = (delivery: any) => {
          const drivers = ['John D.', 'Sarah M.', 'Mike R.', 'Alex T.', 'Unassigned'];
          const driver = window.prompt('Assign driver:', delivery.driver);
          if (driver === null) return;
          
          setDeliveriesData(deliveriesData.map(d => 
            d.id === delivery.id ? { ...d, driver } : d
          ));
          alert(`Assigned ${driver} to this delivery.`);
        };

        const handleUpdateProgress = (delivery: any) => {
          const progress = window.prompt('Update progress (0-100):', delivery.progress.toString());
          if (progress === null) return;
          
          const progressNum = parseInt(progress);
          if (isNaN(progressNum) || progressNum < 0 || progressNum > 100) {
            alert('Please enter a number between 0 and 100.');
            return;
          }
          
          setDeliveriesData(deliveriesData.map(d => 
            d.id === delivery.id ? { ...d, progress: progressNum } : d
          ));
        };

        const handleMarkDelivered = (id: number) => {
          setDeliveriesData(deliveriesData.map(d => 
            d.id === id ? { ...d, status: 'delivered', progress: 100 } : d
          ));
          alert('Delivery marked as delivered!');
        };

        return (
          <div className="bg-white rounded-xl shadow-sm p-6 my-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Deliveries Management</h2>
                <p className="text-gray-600 mt-1">Manage delivery assignments, tracking, and status</p>
              </div>
              <button
                onClick={handleAddDelivery}
                className="mt-4 md:mt-0 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition flex items-center space-x-2"
              >
                <span>+ Add Delivery</span>
              </button>
            </div>

            {/* Delivery Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-600 font-medium">Total Deliveries</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{deliveriesData.length}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-600 font-medium">In Transit</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{deliveriesData.filter(d => d.status === 'in-transit').length}</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-sm text-orange-600 font-medium">Pending</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{deliveriesData.filter(d => d.status === 'pending').length}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-purple-600 font-medium">Delivered Today</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{deliveriesData.filter(d => d.status === 'delivered').length}</p>
              </div>
            </div>

            {/* Deliveries Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {deliveriesData.map((delivery) => (
                    <tr key={delivery.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="p-2 bg-green-100 rounded-lg mr-3">
                            <Package className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{delivery.customer}</p>
                            <p className="text-sm text-gray-600">ID: #{delivery.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-900">{delivery.address}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            delivery.driver === 'Unassigned' ? 'bg-gray-100 text-gray-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {delivery.driver}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          delivery.status === 'delivered' ? 'bg-green-100 text-green-800' :
                          delivery.status === 'in-transit' ? 'bg-blue-100 text-blue-800' :
                          'bg-orange-100 text-orange-800'
                        }`}>
                          {delivery.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-900">{delivery.items} items</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full" 
                              style={{ width: `${delivery.progress}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600">{delivery.progress}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col space-y-2">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleAssignDriver(delivery)}
                              className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium hover:bg-blue-200"
                            >
                              Assign
                            </button>
                            <button
                              onClick={() => handleEditDelivery(delivery)}
                              className="px-3 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium hover:bg-gray-200"
                            >
                              Edit
                            </button>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleUpdateProgress(delivery)}
                              className="px-3 py-1 bg-green-100 text-green-800 rounded text-xs font-medium hover:bg-green-200"
                            >
                              Progress
                            </button>
                            {delivery.status !== 'delivered' && (
                              <button
                                onClick={() => handleMarkDelivered(delivery.id)}
                                className="px-3 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium hover:bg-purple-200"
                              >
                                Deliver
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteDelivery(delivery.id)}
                              className="px-3 py-1 bg-red-100 text-red-800 rounded text-xs font-medium hover:bg-red-200"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing {deliveriesData.length} deliveries
                </p>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => alert('Exporting deliveries data...')}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={() => setActiveTab('vehicles')}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                  >
                    View Vehicles
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      case 'sops':
        const handleAddSOPCategory = () => {
          const name = window.prompt('Enter SOP category name:');
          if (!name) return;
          
          const iconName = window.prompt('Enter icon name (Package, Wrench, AlertTriangle, Users, FileText, etc.):', 'FileText');
          const count = parseInt(window.prompt('Enter initial SOP count:', '5') || '0');
          
          // Find the actual icon component from imports (simplify)
          let IconComponent = FileText;
          
          const newCategory = {
            name,
            count,
            icon: IconComponent // In reality we'd map string to component
          };
          
          setSopCategoriesData([...sopCategoriesData, newCategory]);
          alert(`SOP category "${name}" added!`);
        };

        const handleEditSOPCategory = (category: any) => {
          const newName = window.prompt('Edit category name:', category.name);
          if (newName === null) return;
          
          const newCount = window.prompt('Edit SOP count:', category.count.toString());
          
          const updatedCategories = sopCategoriesData.map(c => 
            c.name === category.name 
              ? { ...c, name: newName || c.name, count: newCount ? parseInt(newCount) : c.count }
              : c
          );
          
          setSopCategoriesData(updatedCategories);
          alert('Category updated!');
        };

        const handleDeleteSOPCategory = (categoryName: string) => {
          if (window.confirm(`Delete category "${categoryName}" and all its SOPs?`)) {
            setSopCategoriesData(sopCategoriesData.filter(c => c.name !== categoryName));
            alert('Category deleted.');
          }
        };

        const handleViewSOPs = (category: any) => {
          alert(`Viewing SOPs in "${category.name}"\n\nThis would open a detailed view with:\n• List of all SOP documents\n• Search and filter\n• Document preview\n• Version history\n• Training completion tracking\n\nTotal SOPs: ${category.count}`);
        };

        const handleAddSOPDocument = (category: any) => {
          const title = window.prompt(`Add new SOP document to "${category.name}":`);
          if (!title) return;
          
          alert(`SOP "${title}" added to ${category.name}!\n\nIn production, this would:\n• Create a new SOP document\n• Upload PDF/Word file\n• Set version number\n• Assign reviewers\n• Notify team members`);
        };

        return (
          <div className="bg-white rounded-xl shadow-sm p-6 my-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Standard Operating Procedures</h2>
                <p className="text-gray-600 mt-1">Manage safety protocols, delivery procedures, and training materials</p>
              </div>
              <button
                onClick={handleAddSOPCategory}
                className="mt-4 md:mt-0 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition flex items-center space-x-2"
              >
                <span>+ Add Category</span>
              </button>
            </div>

            {/* SOP Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-600 font-medium">Total Categories</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{sopCategoriesData.length}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-600 font-medium">Total SOPs</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {sopCategoriesData.reduce((sum, cat) => sum + cat.count, 0)}
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-purple-600 font-medium">Avg per Category</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {sopCategoriesData.length > 0 
                    ? Math.round(sopCategoriesData.reduce((sum, cat) => sum + cat.count, 0) / sopCategoriesData.length)
                    : '0'
                  }
                </p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-sm text-orange-600 font-medium">Training Required</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {sopCategoriesData.reduce((sum, cat) => sum + cat.count, 0) * 2} hrs
                </p>
              </div>
            </div>

            {/* SOP Categories Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sopCategoriesData.map((category) => {
                const Icon = category.icon;
                return (
                  <div key={category.name} className="border rounded-xl p-5 hover:border-primary-300 hover:shadow-md transition">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-3 bg-primary-100 rounded-lg">
                          {Icon && <Icon className="h-6 w-6 text-primary-600" />}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{category.name}</h3>
                          <p className="text-sm text-gray-600">{category.count} SOPs</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleEditSOPCategory(category)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteSOPCategory(category.name)}
                          className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    
                    <div className="mt-4 space-y-3">
                      <button
                        onClick={() => handleViewSOPs(category)}
                        className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
                      >
                        View All SOPs
                      </button>
                      <button
                        onClick={() => handleAddSOPDocument(category)}
                        className="w-full py-2.5 bg-primary-600 text-white hover:bg-primary-700 rounded-lg text-sm font-medium"
                      >
                        + Add SOP Document
                      </button>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>Last updated: Today</span>
                        <span>{Math.ceil(category.count * 0.3)} trained</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
              <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
                <div>
                  <h4 className="font-medium text-gray-900">SOP Library Features</h4>
                  <p className="text-sm text-gray-600 mt-1">Version control, training tracking, document approval workflows</p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => alert('Importing SOP documents...')}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    Import SOPs
                  </button>
                  <button
                    onClick={() => alert('Generating training report...')}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                  >
                    Training Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      case 'maintenance':
        const handleAddMaintenanceTask = () => {
          const vehicle = window.prompt('Enter vehicle name:');
          if (!vehicle) return;
          
          const type = window.prompt('Enter maintenance type (Oil Change, Brake Inspection, Tire Rotation, etc.):');
          const dueDate = window.prompt('Enter due date (YYYY-MM-DD):', '2026-03-01');
          const priority = window.prompt('Enter priority (high/medium/low):', 'medium');
          
          const newTask = {
            id: maintenanceData.length > 0 ? Math.max(...maintenanceData.map(t => t.id)) + 1 : 1,
            vehicle,
            type: type || 'General Maintenance',
            dueDate: dueDate || '2026-03-01',
            priority: (priority === 'high' || priority === 'medium' || priority === 'low') ? priority : 'medium'
          };
          
          setMaintenanceData([...maintenanceData, newTask]);
          alert(`Maintenance task for ${vehicle} added!`);
        };

        const handleEditMaintenanceTask = (task: any) => {
          const newVehicle = window.prompt('Edit vehicle:', task.vehicle);
          if (newVehicle === null) return;
          
          const newType = window.prompt('Edit type:', task.type);
          const newDueDate = window.prompt('Edit due date:', task.dueDate);
          const newPriority = window.prompt('Edit priority:', task.priority);
          
          const updatedTasks = maintenanceData.map(t => 
            t.id === task.id 
              ? {
                  ...t,
                  vehicle: newVehicle || t.vehicle,
                  type: newType || t.type,
                  dueDate: newDueDate || t.dueDate,
                  priority: (newPriority === 'high' || newPriority === 'medium' || newPriority === 'low') ? newPriority : t.priority
                }
              : t
          );
          
          setMaintenanceData(updatedTasks);
          alert('Task updated!');
        };

        const handleDeleteMaintenanceTask = (id: number) => {
          if (window.confirm('Delete this maintenance task?')) {
            setMaintenanceData(maintenanceData.filter(t => t.id !== id));
            alert('Task deleted.');
          }
        };

        const handleMarkCompleted = (id: number) => {
          if (window.confirm('Mark this task as completed?')) {
            setMaintenanceData(maintenanceData.filter(t => t.id !== id));
            alert('Task marked as completed and removed from list.');
          }
        };

        const handleScheduleMaintenance = (task: any) => {
          const date = window.prompt('Schedule maintenance date (YYYY-MM-DD):', task.dueDate);
          if (date) {
            setMaintenanceData(maintenanceData.map(t => 
              t.id === task.id ? { ...t, dueDate: date } : t
            ));
            alert(`Scheduled for ${date}`);
          }
        };

        return (
          <div className="bg-white rounded-xl shadow-sm p-6 my-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Maintenance Management</h2>
                <p className="text-gray-600 mt-1">Schedule, track, and manage vehicle maintenance tasks</p>
              </div>
              <div className="flex items-center space-x-3 mt-4 md:mt-0">
                <button
                  onClick={handleAddMaintenanceTask}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition flex items-center space-x-2"
                >
                  <span>+ Add Task</span>
                </button>
                <button
                  onClick={() => alert('Generating maintenance report...')}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Report
                </button>
              </div>
            </div>

            {/* Maintenance Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-600 font-medium">Total Tasks</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{maintenanceData.length}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-red-600 font-medium">High Priority</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{maintenanceData.filter(t => t.priority === 'high').length}</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-sm text-orange-600 font-medium">Due This Week</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {maintenanceData.filter(t => {
                    const dueDate = new Date(t.dueDate);
                    const today = new Date();
                    const nextWeek = new Date(today);
                    nextWeek.setDate(today.getDate() + 7);
                    return dueDate >= today && dueDate <= nextWeek;
                  }).length}
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-600 font-medium">Completed Today</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">0</p>
              </div>
            </div>

            {/* Maintenance Tasks Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Maintenance Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {maintenanceData.map((task) => (
                    <tr key={task.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="p-2 bg-blue-100 rounded-lg mr-3">
                            <Truck className="h-4 w-4 text-blue-600" />
                          </div>
                          <span className="font-medium text-gray-900">{task.vehicle}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-900">{task.type}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-gray-900">{task.dueDate}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          task.priority === 'high' ? 'bg-red-100 text-red-800' : 
                          task.priority === 'medium' ? 'bg-orange-100 text-orange-800' : 
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Pending
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleScheduleMaintenance(task)}
                            className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded text-xs font-medium hover:bg-blue-200"
                          >
                            Schedule
                          </button>
                          <button
                            onClick={() => handleEditMaintenanceTask(task)}
                            className="px-3 py-1.5 bg-gray-100 text-gray-800 rounded text-xs font-medium hover:bg-gray-200"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleMarkCompleted(task.id)}
                            className="px-3 py-1.5 bg-green-100 text-green-800 rounded text-xs font-medium hover:bg-green-200"
                          >
                            Complete
                          </button>
                          <button
                            onClick={() => handleDeleteMaintenanceTask(task.id)}
                            className="px-3 py-1.5 bg-red-100 text-red-800 rounded text-xs font-medium hover:bg-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
                <div>
                  <h4 className="font-medium text-gray-900">Maintenance Features</h4>
                  <p className="text-sm text-gray-600 mt-1">Preventive scheduling, parts inventory, work order tracking</p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setActiveTab('vehicles')}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    View Vehicles
                  </button>
                  <button
                    onClick={() => alert('Generating maintenance schedule...')}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                  >
                    Generate Schedule
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      case 'reports':
        // Calculate report statistics
        const totalVehicles = vehiclesData.length;
        const activeVehicles = vehiclesData.filter(v => v.status === 'active').length;
        const maintenanceDueCount = vehiclesData.filter(v => v.maintenanceDue).length;
        const totalDeliveries = deliveriesData.length;
        const deliveredCount = deliveriesData.filter(d => d.status === 'delivered').length;
        const pendingDeliveries = deliveriesData.filter(d => d.status === 'pending').length;
        const totalSOPs = sopCategoriesData.reduce((sum, cat) => sum + cat.count, 0);
        const totalMaintenanceTasks = maintenanceData.length;
        const highPriorityTasks = maintenanceData.filter(t => t.priority === 'high').length;

        const handleGenerateReport = (type: string) => {
          alert(`Generating ${type} report...\n\nThis would create a comprehensive PDF/Excel report with:\n• Executive summary\n• Detailed analytics\n• Charts and graphs\n• Recommendations\n• Export options\n\nReport type: ${type}\nDate range: Last 30 days\nFormat: PDF & Excel`);
        };

        const handleExportData = () => {
          alert('Exporting all data...\n\nPreparing CSV files for:\n• Vehicles\n• Deliveries\n• Maintenance tasks\n• SOP categories\n\nFiles will be downloaded as a ZIP archive.');
        };

        const handleScheduleReport = () => {
          const email = window.prompt('Enter email for scheduled reports:', 'admin@fleetflow.com');
          if (email) {
            alert(`Scheduled reports configured!\n\nDaily reports will be sent to: ${email}\n\nReport types:\n• Daily delivery summary\n• Weekly maintenance schedule\n• Monthly financial overview\n• Quarterly safety compliance`);
          }
        };

        return (
          <div className="bg-white rounded-xl shadow-sm p-6 my-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Reports & Analytics</h2>
                <p className="text-gray-600 mt-1">Comprehensive analytics and reporting for fleet operations</p>
              </div>
              <div className="flex items-center space-x-3 mt-4 md:mt-0">
                <button
                  onClick={() => handleGenerateReport('daily')}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                >
                  Generate Report
                </button>
                <button
                  onClick={handleExportData}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Export Data
                </button>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-600 font-medium">Fleet Utilization</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {totalVehicles > 0 ? Math.round((activeVehicles / totalVehicles) * 100) : 0}%
                </p>
                <p className="text-xs text-gray-600 mt-1">{activeVehicles} of {totalVehicles} active</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-600 font-medium">Delivery Success</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {totalDeliveries > 0 ? Math.round((deliveredCount / totalDeliveries) * 100) : 0}%
                </p>
                <p className="text-xs text-gray-600 mt-1">{deliveredCount} of {totalDeliveries} delivered</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-sm text-orange-600 font-medium">Maintenance Health</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {totalVehicles > 0 ? Math.round(((totalVehicles - maintenanceDueCount) / totalVehicles) * 100) : 0}%
                </p>
                <p className="text-xs text-gray-600 mt-1">{maintenanceDueCount} vehicles due</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-purple-600 font-medium">Compliance Score</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {totalSOPs > 0 ? Math.min(100, Math.round(totalSOPs * 5)) : 0}%
                </p>
                <p className="text-xs text-gray-600 mt-1">{totalSOPs} SOPs tracked</p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Vehicle Status Chart */}
              <div className="border rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Vehicle Status Distribution</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Active', count: vehiclesData.filter(v => v.status === 'active').length, color: 'bg-green-500' },
                    { label: 'Inactive', count: vehiclesData.filter(v => v.status === 'inactive').length, color: 'bg-gray-500' },
                    { label: 'Delayed', count: vehiclesData.filter(v => v.status === 'delayed').length, color: 'bg-orange-500' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center">
                      <div className="w-24 text-sm text-gray-600">{item.label}</div>
                      <div className="flex-1 h-6 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${item.color} rounded-full`}
                          style={{ width: `${totalVehicles > 0 ? (item.count / totalVehicles) * 100 : 0}%` }}
                        ></div>
                      </div>
                      <div className="w-12 text-right text-sm font-medium">{item.count}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery Status Chart */}
              <div className="border rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Delivery Status</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Delivered', count: deliveriesData.filter(d => d.status === 'delivered').length, color: 'bg-green-500' },
                    { label: 'In Transit', count: deliveriesData.filter(d => d.status === 'in-transit').length, color: 'bg-blue-500' },
                    { label: 'Pending', count: deliveriesData.filter(d => d.status === 'pending').length, color: 'bg-orange-500' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center">
                      <div className="w-24 text-sm text-gray-600">{item.label}</div>
                      <div className="flex-1 h-6 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${item.color} rounded-full`}
                          style={{ width: `${totalDeliveries > 0 ? (item.count / totalDeliveries) * 100 : 0}%` }}
                        ></div>
                      </div>
                      <div className="w-12 text-right text-sm font-medium">{item.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Report Types */}
            <div className="mb-8">
              <h3 className="font-semibold text-gray-900 mb-4">Available Reports</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { title: 'Daily Delivery Summary', desc: 'Daily delivery performance and metrics', icon: Package },
                  { title: 'Weekly Maintenance Report', desc: 'Maintenance schedule and completed tasks', icon: Wrench },
                  { title: 'Monthly Financial Overview', desc: 'Revenue, expenses, and profitability', icon: DollarSign },
                  { title: 'Vehicle Utilization Analysis', desc: 'Fleet usage and optimization opportunities', icon: Truck },
                  { title: 'Driver Performance Report', desc: 'Driver metrics and safety scores', icon: Users },
                  { title: 'Safety Compliance Report', desc: 'SOP adherence and incident tracking', icon: AlertTriangle },
                ].map((report) => {
                  const Icon = report.icon;
                  return (
                    <div key={report.title} className="border rounded-xl p-4 hover:border-primary-300 hover:shadow-sm transition">
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-primary-100 rounded-lg">
                          <Icon className="h-5 w-5 text-primary-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{report.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">{report.desc}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleGenerateReport(report.title)}
                        className="w-full mt-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
                      >
                        Generate
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Report Scheduling */}
            <div className="p-5 bg-gray-50 rounded-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
                <div>
                  <h4 className="font-medium text-gray-900">Automated Report Scheduling</h4>
                  <p className="text-sm text-gray-600 mt-1">Schedule regular reports to be sent automatically via email</p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleScheduleReport}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                  >
                    Schedule Reports
                  </button>
                  <button
                    onClick={() => alert('Viewing report history...')}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    View History
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

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

              {/* Role Demo Button */}
              <button 
                onClick={() => window.location.href = '/role-demo'}
                className="hidden sm:flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium touch-target"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Role Demo</span>
              </button>

              {/* Mobile Role Demo Button */}
              <button 
                onClick={() => window.location.href = '/role-demo'}
                className="sm:hidden p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 touch-target"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>

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
      {activeTab !== 'overview' && renderManagementContent()}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <div className="text-sm text-gray-600 text-center sm:text-left">
              <p>© 2026 FleetFlow Pro. MVP Demonstration.</p>
              <p className="mt-1">Built for Joseph's Food Truck Delivery Service</p>
              <p className="mt-1">
                <button 
                  onClick={() => window.location.href = '/role-demo'}
                  className="text-primary-600 hover:text-primary-800 font-medium"
                >
                  Explore role-based features →
                </button>
              </p>
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