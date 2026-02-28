import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../lib/auth'
import type { GetServerSidePropsContext } from 'next'
import { 
  Truck, MapPin, Package, Calendar, AlertTriangle, 
  CheckCircle, Clock, Users, BarChart, Battery,
  Navigation, FileVideo, Image, Map, Wrench,
  MessageSquare, Download, Upload, Settings, Bell,
  Search, Menu, X, ChevronRight, Filter, SortAsc,
  Phone, Mail, Map as MapIcon, FileText, Home as HomeIcon, DollarSign,
  Camera, MapPin as MapPinIcon, Building, Car, Star, Shield
} from 'lucide-react'
import AnnouncementModal from '../components/AnnouncementModal'
import VehicleDetailModal from '../components/VehicleDetailModal'
import ClientDetailModal from '../components/ClientDetailModal'
import VendingMachineDetailModal from '../components/VendingMachineDetailModal'
import VehicleFormModal from '../components/VehicleFormModal'
import DeliveryFormModal from '../components/DeliveryFormModal'
import MaintenanceTaskFormModal from '../components/MaintenanceTaskFormModal'
import SOPCategoryFormModal from '../components/SOPCategoryFormModal'
import ClientFormModal from '../components/ClientFormModal'
import VendingMachineFormModal from '../components/VendingMachineFormModal'
import ConfirmModal from '../components/ConfirmModal'
import MobileMenu from '../components/MobileMenu'
import NotificationsCenter from '../components/NotificationsCenter'
import QuickActions from '../components/QuickActions'
import CommandPalette from '../components/CommandPalette'
import ActivityFeed from '../components/ActivityFeed'
import KeyboardShortcutsHelp from '../components/KeyboardShortcutsHelp'
import * as dataService from '../services/dataService'
import { 
  notify,
  vehicleNotifications,
  deliveryNotifications,
  sopNotifications,
  maintenanceNotifications,
  announcementNotifications,
  clientNotifications,
  vendingMachineNotifications,
  reportNotifications,
  confirmAction,
  promptAction
} from '../services/notifications'



// Data will be loaded from dataService

export default function Home() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState('overview')
  const [isLoading, setIsLoading] = useState(true)
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false)
  const [isVehicleDetailModalOpen, setIsVehicleDetailModalOpen] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<dataService.Vehicle | null>(null)
  const [isClientDetailModalOpen, setIsClientDetailModalOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<dataService.Client | null>(null)
  const [clientModalEditMode, setClientModalEditMode] = useState(false)
  const [isVendingMachineModalOpen, setIsVendingMachineModalOpen] = useState(false)
  const [selectedVendingMachine, setSelectedVendingMachine] = useState<dataService.VendingMachine | null>(null)
  const [vehicleFilter, setVehicleFilter] = useState('all')
  
  // Form modal states
  const [isVehicleFormOpen, setIsVehicleFormOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<dataService.Vehicle | null>(null)
  const [isDeliveryFormOpen, setIsDeliveryFormOpen] = useState(false)
  const [editingDelivery, setEditingDelivery] = useState<dataService.Delivery | null>(null)
  const [isMaintenanceFormOpen, setIsMaintenanceFormOpen] = useState(false)
  const [editingMaintenanceTask, setEditingMaintenanceTask] = useState<dataService.MaintenanceTask | null>(null)
  const [isSOPCategoryFormOpen, setIsSOPCategoryFormOpen] = useState(false)
  const [editingSOPCategory, setEditingSOPCategory] = useState<dataService.SOPCategory | null>(null)
  const [isClientFormOpen, setIsClientFormOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<dataService.Client | null>(null)
  const [isVendingMachineFormOpen, setIsVendingMachineFormOpen] = useState(false)
  const [editingVendingMachine, setEditingVendingMachine] = useState<dataService.VendingMachine | null>(null)
  
  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
    variant?: 'danger' | 'warning' | 'info'
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  })
  
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  // New UX components state
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isKeyboardShortcutsOpen, setIsKeyboardShortcutsOpen] = useState(false)

  // Data state
  const [vehiclesData, setVehiclesData] = useState<dataService.Vehicle[]>([])
  const [deliveriesData, setDeliveriesData] = useState<dataService.Delivery[]>([])
  const [maintenanceData, setMaintenanceData] = useState<dataService.MaintenanceTask[]>([])
  const [sopCategoriesData, setSopCategoriesData] = useState<dataService.SOPCategory[]>([])
  const [announcements, setAnnouncements] = useState<dataService.Announcement[]>([])
  const [clients, setClients] = useState<dataService.Client[]>([])
  const [vendingMachines, setVendingMachines] = useState<dataService.VendingMachine[]>([])

  // Load data on component mount
  useEffect(() => {
    const loadData = () => {
      try {
        setVehiclesData(dataService.getVehicles())
        setDeliveriesData(dataService.getDeliveries())
        setMaintenanceData(dataService.getMaintenanceTasks())
        setSopCategoriesData(dataService.getSOPCategories())
        setAnnouncements(dataService.getAnnouncements())
        setClients(dataService.getClients())
        setVendingMachines(dataService.getVendingMachines())
        setIsLoading(false)
      } catch (error) {
        console.error('Failed to load data:', error)
        notify.error('Failed to load data. Please refresh the page.')
        setIsLoading(false)
      }
    }
    
    loadData()
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

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command palette: Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsCommandPaletteOpen(prev => !prev)
      }
      
      // Notifications: N key (when not in input)
      if (e.key === 'n' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault()
        setIsNotificationsOpen(prev => !prev)
      }
      
      // Keyboard shortcuts help: ? key (when not in input)
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault()
        setIsKeyboardShortcutsOpen(true)
      }
      
      // Close panels on Escape
      if (e.key === 'Escape') {
        setIsNotificationsOpen(false)
        setIsCommandPaletteOpen(false)
        setIsKeyboardShortcutsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Filter vehicles based on selected filter
  const filteredVehicles = vehiclesData.filter(vehicle => {
    if (vehicleFilter === 'all') return true
    return vehicle.status === vehicleFilter
  })

  // Calculate stats from data
  const stats = [
    { 
      label: 'Active Vehicles', 
      value: vehiclesData.filter(v => v.status === 'active').length.toString(), 
      icon: Truck, 
      color: 'text-green-600', 
      bgColor: 'bg-green-100', 
      change: '+0' 
    },
    { 
      label: 'Today\'s Deliveries', 
      value: deliveriesData.filter(d => d.status === 'in-transit' || d.status === 'pending').length.toString(), 
      icon: Package, 
      color: 'text-blue-600', 
      bgColor: 'bg-blue-100', 
      change: '+0' 
    },
    { 
      label: 'Pending SOPs', 
      value: sopCategoriesData.reduce((sum, cat) => sum + cat.count, 0).toString(), 
      icon: FileVideo, 
      color: 'text-purple-600', 
      bgColor: 'bg-purple-100', 
      change: '+0' 
    },
    { 
      label: 'Maintenance Due', 
      value: maintenanceData.filter(t => !t.completed && new Date(t.dueDate) <= new Date()).length.toString(), 
      icon: AlertTriangle, 
      color: 'text-orange-600', 
      bgColor: 'bg-orange-100', 
      change: '+0' 
    },
  ]

  const handleQuickAction = async (action: string) => {
    // Parse the action to determine what to do
    if (action.startsWith('View ') && action.includes('Videos')) {
      const category = action.replace('View ', '').replace(' Videos', '')
      notify.info(`Loading ${category} training videos...`, { duration: 3000 })
      // In production, would open video library
    } else if (action.startsWith('View ') && action.includes('Images')) {
      const category = action.replace('View ', '').replace(' Images', '')
      notify.info(`Opening ${category} image gallery...`, { duration: 3000 })
      // In production, would open image gallery
    } else if (action.startsWith('Download ') && action.includes('PDFs')) {
      const category = action.replace('Download ', '').replace(' PDFs', '')
      notify.info(`Downloading ${category} PDF documents...`, { duration: 3000 })
      // In production, would trigger PDF download
    } else if (action.startsWith('Schedule ') || action.startsWith('Reschedule ')) {
      const isReschedule = action.startsWith('Reschedule ')
      const taskInfo = action.replace('Schedule ', '').replace('Reschedule ', '')
      const [type, ...vehicleParts] = taskInfo.split(' for ')
      const vehicle = vehicleParts.join(' for ')
      
      const date = await promptAction(
        `${isReschedule ? 'Reschedule' : 'Schedule'} ${type} for ${vehicle}\nEnter date (YYYY-MM-DD):`,
        new Date().toISOString().split('T')[0]
      )
      
      if (date) {
        notify.success(`${isReschedule ? 'Rescheduled' : 'Scheduled'} ${type} for ${vehicle} on ${date}`)
        // In production, would update the database
      }
    } else if (action.startsWith('View ')) {
      const category = action.replace('View ', '')
      notify.info(`Opening ${category} procedures...`, { duration: 3000 })
      setActiveTab('sops')
      // In production, would filter SOPs by category
    } else {
      notify.info(`Action: ${action}`, { duration: 3000 })
    }
  }

  const handleOpenAnnouncementModal = () => {
    setIsAnnouncementModalOpen(true)
  }

  const handleCloseAnnouncementModal = () => {
    setIsAnnouncementModalOpen(false)
  }

  const handleSendAnnouncement = (message: string, priority: string, recipients: string) => {
    try {
      dataService.addAnnouncement({
        message,
        priority: priority as 'low' | 'normal' | 'high' | 'urgent',
        recipients,
      })
      announcementNotifications.sent(recipients)
      setIsAnnouncementModalOpen(false)
      // Refresh announcements
      setAnnouncements(dataService.getAnnouncements())
    } catch (error) {
      announcementNotifications.error(error instanceof Error ? error.message : 'Unknown error')
    }
  }

  const handleOpenVehicleDetailModal = (vehicle: dataService.Vehicle) => {
    setSelectedVehicle(vehicle)
    setIsVehicleDetailModalOpen(true)
  }

  const handleCloseVehicleDetailModal = () => {
    setIsVehicleDetailModalOpen(false)
    setSelectedVehicle(null)
  }

  const handleOpenClientDetailModal = (client: dataService.Client, editMode: boolean = false) => {
    setSelectedClient(client)
    setClientModalEditMode(editMode)
    setIsClientDetailModalOpen(true)
  }

  const handleCloseClientDetailModal = () => {
    setIsClientDetailModalOpen(false)
    setSelectedClient(null)
    setClientModalEditMode(false)
  }

  const handleClientUpdated = () => {
    refreshData()
  }

  const handleOpenVendingMachineModal = (machine: dataService.VendingMachine) => {
    setSelectedVendingMachine(machine)
    setIsVendingMachineModalOpen(true)
  }

  const handleCloseVendingMachineModal = () => {
    setIsVendingMachineModalOpen(false)
    setSelectedVendingMachine(null)
  }

  const handleVendingMachineUpdated = (updated: dataService.VendingMachine) => {
    setVendingMachines(prev => prev.map(m => m.id === updated.id ? updated : m))
    setSelectedVendingMachine(updated)
  }

  const handleHelpSupport = () => {
    notify.info(
      '📞 Support: 1-800-FLEETFLOW\n✉️ Email: support@fleetflow.com\n🕒 Hours: Mon-Fri 8am-6pm EST',
      { duration: 4000 }
    )
  }

  const handleSettings = async () => {
    // For now, show a simple settings selection
    // In production, this would open a full settings modal
    const setting = await promptAction(
      'Quick Settings:\n1. Theme (light/dark)\n2. Notifications (on/off)\n3. Language\n\nEnter setting number to adjust:',
      '1'
    )
    
    if (!setting) return
    
    switch (setting.trim()) {
      case '1':
        notify.info('Theme settings would be adjustable here.', { duration: 3000 })
        break
      case '2':
        notify.info('Notification preferences would be configurable here.', { duration: 3000 })
        break
      case '3':
        notify.info('Language selection would be available here.', { duration: 3000 })
        break
      default:
        notify.info('Settings panel would open with full options.', { duration: 3000 })
    }
  }

  const handleGoogleMapsDemo = () => {
    const demoAddress = '1600+Amphitheatre+Parkway,+Mountain+View,+CA'
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${demoAddress}&travelmode=driving`
    notify.info(
      'Opening Google Maps navigation...',
      { duration: 2000 }
    )
    window.open(mapsUrl, '_blank', 'noopener,noreferrer')
  }

  const handleUploadSOP = () => {
    // Create a file input element
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4,.mov'
    fileInput.multiple = true
    
    fileInput.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files
      if (!files || files.length === 0) return
      
      const loadingToast = notify.loading(`Uploading ${files.length} file(s)...`)
      
      // Simulate upload process
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      notify.dismiss(loadingToast)
      notify.success(`Successfully uploaded ${files.length} file(s) to SOP library`)
      
      // In production, files would be uploaded to cloud storage
      // and metadata would be added to the database
    }
    
    fileInput.click()
  }

  const handlePlanRoute = () => {
    // For now, open Google Maps with multiple stops
    // In production, this would open a full route planning interface
    const origin = 'New+York+City,NY'
    const waypoint1 = 'Philadelphia,PA'
    const waypoint2 = 'Baltimore,MD'
    const destination = 'Washington,DC'
    
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&waypoints=${waypoint1}|${waypoint2}&destination=${destination}&travelmode=driving`
    
    notify.info(
      'Opening route planner...',
      { duration: 2000 }
    )
    
    window.open(mapsUrl, '_blank', 'noopener,noreferrer')
  }

  const handleNotifyDrivers = () => {
    setIsAnnouncementModalOpen(true)
  }

  const handleViewReports = () => {
    setActiveTab('reports')
    notify.info(
      'Opening reports dashboard...',
      { duration: 2000 }
    )
  }

  const handleExploreDemoData = () => {
    notify.info(
      `Loading ${activeTab} data...`,
      { duration: 2000 }
    )
  }

  const handleViewReportHistory = () => {
    notify.info(
      'Opening report history...',
      { duration: 2000 }
    )
    // In production, would show past generated reports
  }

  const handleViewDocumentation = () => {
    notify.info(
      'Opening documentation...',
      { duration: 2000 }
    )
    // In production, would open documentation portal
    window.open('https://docs.fleetflow.com', '_blank', 'noopener,noreferrer')
  }

  const handleCallDriver = async (driverName: string) => {
    const confirmed = await confirmAction(`Call ${driverName}?`)
    if (!confirmed) return
    
    // In production, this would use the driver's actual phone number from database
    // For now, we'll use a placeholder
    const phoneNumber = '+15551234567' // Placeholder - would be fetched from driver profile
    notify.info(
      `Calling ${driverName}...`,
      { duration: 2000 }
    )
    
    // Open phone dialer
    window.open(`tel:${phoneNumber}`, '_self')
  }

  const handleNavigateToAddress = (address: string) => {
    const encodedAddress = encodeURIComponent(address)
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving`
    notify.info(
      `Opening navigation to ${address}`,
      { duration: 2000 }
    )
    window.open(mapsUrl, '_blank', 'noopener,noreferrer')
  }

  const handleTrackDelivery = (customer: string) => {
    notify.info(
      `Tracking delivery to ${customer}`,
      { duration: 2000 }
    )
    setActiveTab('deliveries')
  }

  const handleViewClientDeliveryHistory = (clientName: string) => {
    notify.info(
      `Showing delivery history for ${clientName}`,
      { duration: 2000 }
    )
    setActiveTab('deliveries')
    // In production, would filter deliveries by client
  }

  // Refresh all data from dataService
  const refreshData = () => {
    setVehiclesData(dataService.getVehicles())
    setDeliveriesData(dataService.getDeliveries())
    setMaintenanceData(dataService.getMaintenanceTasks())
    setSopCategoriesData(dataService.getSOPCategories())
    setAnnouncements(dataService.getAnnouncements())
    setClients(dataService.getClients())
    setVendingMachines(dataService.getVendingMachines())
  }

  // Vehicle form handlers
  const handleAddVehicle = () => {
    setEditingVehicle(null)
    setIsVehicleFormOpen(true)
  }

  const handleEditVehicle = (vehicle: dataService.Vehicle) => {
    setEditingVehicle(vehicle)
    setIsVehicleFormOpen(true)
  }
  
  const handleVehicleFormSubmit = (vehicle: dataService.Vehicle) => {
    if (editingVehicle) {
      vehicleNotifications.updated(vehicle.name)
    } else {
      vehicleNotifications.added(vehicle.name)
    }
    refreshData()
  }

  // Delivery form handlers
  const handleAddDelivery = () => {
    setEditingDelivery(null)
    setIsDeliveryFormOpen(true)
  }

  const handleEditDelivery = (delivery: dataService.Delivery) => {
    setEditingDelivery(delivery)
    setIsDeliveryFormOpen(true)
  }
  
  const handleDeliveryFormSubmit = (delivery: dataService.Delivery) => {
    if (editingDelivery) {
      deliveryNotifications.updated(delivery.customer)
    } else {
      deliveryNotifications.added(delivery.customer)
    }
    refreshData()
  }

  // Maintenance form handlers
  const handleAddMaintenanceTask = () => {
    setEditingMaintenanceTask(null)
    setIsMaintenanceFormOpen(true)
  }

  const handleEditMaintenanceTask = (task: dataService.MaintenanceTask) => {
    setEditingMaintenanceTask(task)
    setIsMaintenanceFormOpen(true)
  }
  
  const handleMaintenanceFormSubmit = (task: dataService.MaintenanceTask) => {
    if (editingMaintenanceTask) {
      maintenanceNotifications.taskUpdated()
    } else {
      maintenanceNotifications.taskAdded(task.vehicle)
    }
    refreshData()
  }

  // SOP Category form handlers
  const handleAddSOPCategory = () => {
    setEditingSOPCategory(null)
    setIsSOPCategoryFormOpen(true)
  }

  const handleEditSOPCategory = (category: dataService.SOPCategory) => {
    setEditingSOPCategory(category)
    setIsSOPCategoryFormOpen(true)
  }
  
  const handleSOPCategoryFormSubmit = (category: dataService.SOPCategory) => {
    if (editingSOPCategory) {
      sopNotifications.categoryUpdated(category.name)
    } else {
      sopNotifications.categoryAdded(category.name)
    }
    refreshData()
  }

  // Client form handlers
  const handleAddClient = () => {
    setEditingClient(null)
    setIsClientFormOpen(true)
  }

  const handleEditClient = (client: dataService.Client) => {
    setEditingClient(client)
    setIsClientFormOpen(true)
  }
  
  const handleClientFormSubmit = (client: dataService.Client) => {
    if (editingClient) {
      clientNotifications.updated(client.name)
    } else {
      clientNotifications.added(client.name)
    }
    refreshData()
  }

  // Vending Machine form handlers
  const handleAddVendingMachine = () => {
    setEditingVendingMachine(null)
    setIsVendingMachineFormOpen(true)
  }

  const handleEditVendingMachine = (machine: dataService.VendingMachine) => {
    setEditingVendingMachine(machine)
    setIsVendingMachineFormOpen(true)
  }
  
  const handleVendingMachineFormSubmit = (machine: dataService.VendingMachine) => {
    if (editingVendingMachine) {
      vendingMachineNotifications.updated(machine.name)
    } else {
      vendingMachineNotifications.added(machine.name)
    }
    refreshData()
  }

  // Confirm modal helper
  const showConfirmModal = (options: {
    title: string
    message: string
    onConfirm: () => void
    variant?: 'danger' | 'warning' | 'info'
  }) => {
    setConfirmModal({
      isOpen: true,
      ...options
    })
  }

  const handleCloseConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }))
  }

  // Management content renderer
  const renderManagementContent = () => {
    switch (activeTab) {
      case 'vehicles':
        const handleDeleteVehicle = (id: number) => {
          const vehicle = vehiclesData.find(v => v.id === id);
          showConfirmModal({
            title: 'Delete Vehicle',
            message: `Are you sure you want to delete "${vehicle?.name}"? This action cannot be undone.`,
            variant: 'danger',
            onConfirm: () => {
              try {
                const success = dataService.deleteVehicle(id);
                if (success) {
                  vehicleNotifications.deleted(vehicle?.name || 'Vehicle');
                  refreshData();
                }
              } catch (error) {
                vehicleNotifications.error('delete', error instanceof Error ? error.message : undefined);
              }
            }
          });
        };

        const handleToggleMaintenance = (id: number) => {
          try {
            const vehicle = vehiclesData.find(v => v.id === id);
            if (vehicle) {
              dataService.updateVehicle(id, { maintenanceDue: !vehicle.maintenanceDue });
              refreshData();
            }
          } catch (error) {
            vehicleNotifications.error('update maintenance status', error instanceof Error ? error.message : undefined);
          }
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
                  onClick={() => reportNotifications.exported()}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center space-x-2"
                >
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
          </div>
        );
      case 'deliveries':
        const handleDeleteDelivery = (id: number) => {
          const delivery = deliveriesData.find(d => d.id === id);
          showConfirmModal({
            title: 'Delete Delivery',
            message: `Are you sure you want to delete the delivery for "${delivery?.customer}"?`,
            variant: 'danger',
            onConfirm: () => {
              try {
                const success = dataService.deleteDelivery(id);
                if (success) {
                  deliveryNotifications.deleted(delivery?.customer || 'Delivery');
                  refreshData();
                }
              } catch (error) {
                deliveryNotifications.error('delete', error instanceof Error ? error.message : undefined);
              }
            }
          });
        };

        const handleAssignDriver = async (delivery: dataService.Delivery) => {
          const drivers = ['John D.', 'Sarah M.', 'Mike R.', 'Alex T.', 'Unassigned'];
          const driver = await promptAction('Assign driver:', delivery.driver);
          if (driver === null) return;
          
          try {
            const updated = dataService.updateDelivery(delivery.id, { driver });
            if (updated) {
              deliveryNotifications.assigned(driver);
              refreshData();
            }
          } catch (error) {
            deliveryNotifications.error('assign driver', error instanceof Error ? error.message : undefined);
          }
        };

        const handleUpdateProgress = async (delivery: dataService.Delivery) => {
          const progress = await promptAction('Update progress (0-100):', delivery.progress.toString());
          if (progress === null) return;
          
          const progressNum = parseInt(progress);
          if (isNaN(progressNum) || progressNum < 0 || progressNum > 100) {
            notify.error('Please enter a number between 0 and 100.');
            return;
          }
          
          try {
            const updated = dataService.updateDelivery(delivery.id, { progress: progressNum });
            if (updated) {
              refreshData();
            }
          } catch (error) {
            deliveryNotifications.error('update progress', error instanceof Error ? error.message : undefined);
          }
        };

        const handleMarkDelivered = (id: number) => {
          try {
            const delivery = deliveriesData.find(d => d.id === id);
            if (delivery) {
              dataService.updateDelivery(id, { 
                status: 'delivered', 
                progress: 100,
                completedTime: new Date().toISOString()
              });
              deliveryNotifications.delivered(delivery.customer);
              refreshData();
            }
          } catch (error) {
            deliveryNotifications.error('mark as delivered', error instanceof Error ? error.message : undefined);
          }
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
                    onClick={() => reportNotifications.exported()}
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
        const handleAddSOPCategory = async () => {
          const name = await promptAction('Enter SOP category name:');
          if (!name) return;
          
          const countInput = await promptAction('Enter initial SOP count:', '5');
          const count = parseInt(countInput || '0');
          
          try {
            const newCategory = dataService.addSOPCategory({
              name,
              count,
              description: ''
            });
            sopNotifications.categoryAdded(name);
            refreshData();
          } catch (error) {
            sopNotifications.error('add', error instanceof Error ? error.message : undefined);
          }
        };

        const handleEditSOPCategory = async (category: dataService.SOPCategory) => {
          const newName = await promptAction('Edit category name:', category.name);
          if (newName === null) return;
          
          const newCount = await promptAction('Edit SOP count:', category.count.toString());
          
          try {
            const updated = dataService.updateSOPCategory(category.id, {
              name: newName || category.name,
              count: newCount ? parseInt(newCount) : category.count
            });
            if (updated) {
              sopNotifications.categoryUpdated(updated.name);
              refreshData();
            }
          } catch (error) {
            sopNotifications.error('update', error instanceof Error ? error.message : undefined);
          }
        };

        const handleDeleteSOPCategory = (category: dataService.SOPCategory) => {
          showConfirmModal({
            title: 'Delete SOP Category',
            message: `Delete "${category.name}" and all ${category.count} SOP document${category.count !== 1 ? 's' : ''}?`,
            variant: 'danger',
            onConfirm: () => {
              try {
                const success = dataService.deleteSOPCategory(category.id);
                if (success) {
                  sopNotifications.categoryDeleted(category.name);
                  refreshData();
                }
              } catch (error) {
                sopNotifications.error('delete', error instanceof Error ? error.message : undefined);
              }
            }
          });
        };

        const handleViewSOPs = (category: any) => {
          notify.info(
            `Opening ${category.name} SOPs (${category.count} documents)`,
            { duration: 3000 }
          );
          // In production, would open SOP document list view
        };

        const handleAddSOPDocument = async (category: dataService.SOPCategory) => {
          const title = await promptAction(`Add new SOP document to "${category.name}":`);
          if (!title) return;
          
          // In production, would create SOP document in database
          // For now, update the category count
          try {
            const updated = dataService.updateSOPCategory(category.id, {
              count: category.count + 1
            });
            if (updated) {
              sopNotifications.sopAdded(title);
              refreshData();
            }
          } catch (error) {
            sopNotifications.error('add document', error instanceof Error ? error.message : undefined);
          }
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
                const Icon = FileText; // Default icon, could map based on category name
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
                          onClick={() => handleDeleteSOPCategory(category)}
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
                    onClick={handleUploadSOP}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    Import SOPs
                  </button>
                  <button
                    onClick={() => reportNotifications.generating('training')}
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
        const handleDeleteMaintenanceTask = (id: number) => {
          const task = maintenanceData.find(t => t.id === id);
          showConfirmModal({
            title: 'Delete Maintenance Task',
            message: `Delete the ${task?.type} task for ${task?.vehicle}?`,
            variant: 'warning',
            onConfirm: () => {
              try {
                const success = dataService.deleteMaintenanceTask(id);
                if (success) {
                  maintenanceNotifications.taskDeleted();
                  refreshData();
                }
              } catch (error) {
                maintenanceNotifications.error('delete', error instanceof Error ? error.message : undefined);
              }
            }
          });
        };

        const handleMarkCompleted = async (id: number) => {
          const confirmed = await confirmAction(
            'Mark this task as completed?',
            'Complete Maintenance Task'
          );
          if (confirmed) {
            try {
              const success = dataService.updateMaintenanceTask(id, { completed: true, completedDate: new Date().toISOString() });
              if (success) {
                maintenanceNotifications.taskCompleted();
                refreshData();
              }
            } catch (error) {
              maintenanceNotifications.error('complete', error instanceof Error ? error.message : undefined);
            }
          }
        };

        const handleScheduleMaintenance = async (task: dataService.MaintenanceTask) => {
          const date = await promptAction('Schedule maintenance date (YYYY-MM-DD):', task.dueDate);
          if (date) {
            try {
              const updated = dataService.updateMaintenanceTask(task.id, { dueDate: date });
              if (updated) {
                maintenanceNotifications.taskScheduled(date);
                refreshData();
              }
            } catch (error) {
              maintenanceNotifications.error('schedule', error instanceof Error ? error.message : undefined);
            }
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
                  onClick={() => reportNotifications.generating('maintenance')}
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
                    onClick={() => reportNotifications.generating('maintenance schedule')}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                  >
                    Generate Schedule
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      case 'clients': {
        const handleDeleteClient = (id: number) => {
          const client = clients.find(c => c.id === id);
          showConfirmModal({
            title: 'Delete Client',
            message: `Are you sure you want to delete "${client?.name}"? This action cannot be undone.`,
            variant: 'danger',
            onConfirm: () => {
              try {
                const success = dataService.deleteClient(id);
                if (success) {
                  clientNotifications.deleted(client?.name || 'Client');
                  refreshData();
                }
              } catch (error) {
                clientNotifications.error('delete', error instanceof Error ? error.message : undefined);
              }
            }
          });
        };

        const handleViewClientDetails = (client: dataService.Client) => {
          handleOpenClientDetailModal(client);
        };

        const handleAddLocationPhoto = async (client: dataService.Client) => {
          const caption = await promptAction('Enter caption for location photo:', 'Front entrance');
          if (caption) {
            // In production, this would open file picker and upload
            clientNotifications.locationPhotoAdded(client.name);
            notify.info(
              `Location photo upload for ${client.name}\n\n` +
              `Caption: ${caption}\n\n` +
              `In production, this would:\n` +
              `• Open file picker for image\n` +
              `• Capture GPS coordinates\n` +
              `• Upload to cloud storage\n` +
              `• Link to client profile`,
              { duration: 5000 }
            );
          }
        };

        const handleAddLocationPin = async (client: dataService.Client) => {
          const notes = await promptAction('Enter notes for location pin:', 'Parking spot');
          if (notes) {
            // In production, this would open map for pin placement
            clientNotifications.locationPinAdded(client.name);
            notify.info(
              `Location pin for ${client.name}\n\n` +
              `Notes: ${notes}\n\n` +
              `In production, this would:\n` +
              `• Open interactive map\n` +
              `• Allow pin placement\n` +
              `• Capture GPS coordinates\n` +
              `• Save to client profile`,
              { duration: 5000 }
            );
          }
        };

        return (
          <div className="bg-white rounded-xl shadow-sm p-6 my-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Client Database</h2>
                <p className="text-gray-600 mt-1">Manage client information, delivery preferences, and location data</p>
              </div>
              <button
                onClick={handleAddClient}
                className="mt-4 md:mt-0 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition flex items-center space-x-2"
              >
                <span>+ Add Client</span>
              </button>
            </div>

            {/* Client Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-700">Total Clients</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">{clients.length}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-700">Restaurants</p>
                <p className="text-2xl font-bold text-green-900 mt-1">
                  {clients.filter(c => c.type === 'restaurant').length}
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-purple-700">Hotels</p>
                <p className="text-2xl font-bold text-purple-900 mt-1">
                  {clients.filter(c => c.type === 'hotel').length}
                </p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-sm text-orange-700">Avg. Rating</p>
                <p className="text-2xl font-bold text-orange-900 mt-1">
                  {clients.length > 0 
                    ? (clients.reduce((sum, c) => sum + (c.rating || 0), 0) / clients.length).toFixed(1)
                    : '0.0'}
                </p>
              </div>
            </div>

            {/* Client List */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Client</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Address</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Last Delivery</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Rating</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{client.name}</p>
                          <p className="text-sm text-gray-600">{client.businessName || 'No business name'}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          client.type === 'restaurant' ? 'bg-blue-100 text-blue-800' :
                          client.type === 'hotel' ? 'bg-purple-100 text-purple-800' :
                          client.type === 'office' ? 'bg-green-100 text-green-800' :
                          client.type === 'retail' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {client.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">{client.address}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {client.lastDeliveryDate ? new Date(client.lastDeliveryDate).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          {[1,2,3,4,5].map((star) => (
                            <Star 
                              key={star} 
                              className={`h-4 w-4 ${star <= (client.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleViewClientDetails(client)}
                            className="px-3 py-1 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleOpenClientDetailModal(client, true)}
                            className="px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClient(client.id)}
                            className="px-3 py-1 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                          >
                            Delete
                          </button>
                          <div className="relative group">
                            <button className="px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
                              More
                            </button>
                            <div className="absolute right-0 mt-1 w-48 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                              <button
                                onClick={() => handleAddLocationPhoto(client)}
                                className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                              >
                                Add Location Photo
                              </button>
                              <button
                                onClick={() => handleAddLocationPin(client)}
                                className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                              >
                                Add Location Pin
                              </button>
                              <button
                                onClick={() => handleViewClientDeliveryHistory(client.name)}
                                className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                              >
                                View Delivery History
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Client Features */}
            <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="text-lg font-medium text-blue-900">Client Location Features</h3>
              <p className="text-blue-700 mt-2">
                The client database supports location intelligence for better deliveries:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="bg-white p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 flex items-center">
                    <Camera className="h-5 w-5 text-blue-600 mr-2" />
                    Location Photos
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Drivers can upload photos of parking spots, entrances, and delivery areas for each client location.
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 flex items-center">
                    <MapPin className="h-5 w-5 text-blue-600 mr-2" />
                    Location Pins
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Dispatchers can place precise GPS pins on maps for exact delivery locations and parking spots.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      }
      case 'vending': {
        const handleDeleteVendingMachine = (id: number) => {
          const machine = vendingMachines.find(m => m.id === id)
          showConfirmModal({
            title: 'Delete Vending Machine',
            message: `Delete "${machine?.name}"? All handoff notes will be lost.`,
            variant: 'danger',
            onConfirm: () => {
              try {
                dataService.deleteVendingMachine(id)
                vendingMachineNotifications.deleted(machine?.name || 'Machine')
                refreshData()
              } catch (error) {
                vendingMachineNotifications.error('delete', error instanceof Error ? error.message : undefined)
              }
            }
          })
        }

        const STATUS_COLORS: Record<dataService.VendingMachine['status'], string> = {
          operational: 'bg-green-100 text-green-800',
          'needs-restock': 'bg-yellow-100 text-yellow-800',
          'needs-maintenance': 'bg-red-100 text-red-800',
          offline: 'bg-gray-100 text-gray-800',
        }

        const STATUS_LABELS: Record<dataService.VendingMachine['status'], string> = {
          operational: 'Operational',
          'needs-restock': 'Needs Restock',
          'needs-maintenance': 'Needs Maintenance',
          offline: 'Offline',
        }

        return (
          <div className="bg-white rounded-xl shadow-sm p-6 my-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Vending Machines</h2>
                <p className="text-gray-600 mt-1">Track machines, leave handoff notes for the next driver or technician</p>
              </div>
              <button
                onClick={handleAddVendingMachine}
                className="mt-4 md:mt-0 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition flex items-center space-x-2"
              >
                <span>+ Add Machine</span>
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-700">Total Machines</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">{vendingMachines.length}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-700">Operational</p>
                <p className="text-2xl font-bold text-green-900 mt-1">
                  {vendingMachines.filter(m => m.status === 'operational').length}
                </p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-sm text-yellow-700">Needs Attention</p>
                <p className="text-2xl font-bold text-yellow-900 mt-1">
                  {vendingMachines.filter(m => m.status !== 'operational' && m.status !== 'offline').length}
                </p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-red-700">Open Notes</p>
                <p className="text-2xl font-bold text-red-900 mt-1">
                  {vendingMachines.reduce((sum, m) => sum + m.notes.filter(n => !n.resolved).length, 0)}
                </p>
              </div>
            </div>

            {/* Machine list */}
            {vendingMachines.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium text-gray-500">No vending machines yet</p>
                <p className="text-sm mt-1">Add a machine to start tracking handoff notes.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Machine</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Location</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Open Notes</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendingMachines.map(machine => {
                      const openNotes = machine.notes.filter(n => !n.resolved)
                      return (
                        <tr key={machine.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <p className="font-medium text-gray-900">{machine.name}</p>
                            <p className="text-xs text-gray-400 font-mono">{machine.machineId}</p>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600 max-w-xs">
                            <p>{machine.location}</p>
                            {machine.locationDetail && (
                              <p className="text-xs text-gray-400">{machine.locationDetail}</p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600 capitalize">{machine.type}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[machine.status]}`}>
                              {STATUS_LABELS[machine.status]}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {openNotes.length > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                {openNotes.length} open
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">None</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleOpenVendingMachineModal(machine)}
                                className="px-3 py-1 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition"
                              >
                                View
                              </button>
                              <button
                                onClick={() => handleDeleteVendingMachine(machine.id)}
                                className="px-3 py-1 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      }
      case 'reports': {
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
          reportNotifications.generating(type);
          notify.info(
            `Generating ${type} report...\n\nThis would create a comprehensive PDF/Excel report with:\n• Executive summary\n• Detailed analytics\n• Charts and graphs\n• Recommendations\n• Export options\n\nReport type: ${type}\nDate range: Last 30 days\nFormat: PDF & Excel`,
            { duration: 5000 }
          );
        };

        const handleExportData = () => {
          reportNotifications.exported();
          notify.info(
            'Exporting all data...\n\nPreparing CSV files for:\n• Vehicles\n• Deliveries\n• Maintenance tasks\n• SOP categories\n\nFiles will be downloaded as a ZIP archive.',
            { duration: 5000 }
          );
        };

        const handleScheduleReport = async () => {
          const email = await promptAction('Enter email for scheduled reports:', 'admin@fleetflow.com');
          if (email) {
            reportNotifications.scheduled(email);
            notify.info(
              `Scheduled reports configured!\n\nDaily reports will be sent to: ${email}\n\nReport types:\n• Daily delivery summary\n• Weekly maintenance schedule\n• Monthly financial overview\n• Quarterly safety compliance`,
              { duration: 5000 }
            );
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
                    onClick={handleViewReportHistory}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    View History
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      }
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
                  <div className="flex items-baseline space-x-2">
                    <h1 className="text-lg sm:text-xl font-bold text-gray-900">FleetFlow Pro</h1>
                    <span className="text-xs px-1.5 py-0.5 bg-primary-100 text-primary-800 rounded-full font-medium">
                      v{process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'}
                    </span>
                  </div>
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
                <button 
                  onClick={() => setIsNotificationsOpen(true)}
                  className="p-2 rounded-lg hover:bg-gray-100 relative touch-target"
                >
                  <Bell className="h-5 w-5 text-gray-600" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
              </div>

              {/* Command Palette Toggle */}
              <button 
                onClick={() => setIsCommandPaletteOpen(true)}
                className="hidden md:flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition text-sm"
                title="Command Palette (Ctrl+K)"
              >
                <Search className="h-4 w-4" />
                <kbd className="hidden lg:block px-1.5 py-0.5 text-xs bg-gray-200 rounded">Ctrl K</kbd>
              </button>

              {/* Admin Link - Only for admins */}
              {session?.user?.role === 'admin' && (
                <a
                  href="/admin/users"
                  className="hidden sm:flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium touch-target"
                >
                  <Shield className="h-4 w-4" />
                  <span>Admin</span>
                </a>
              )}

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
              {['overview', 'vehicles', 'deliveries', 'sops', 'maintenance', 'clients', 'vending', 'reports'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-2 rounded-lg font-medium text-sm transition whitespace-nowrap touch-target ${
                    activeTab === tab 
                      ? 'bg-primary-50 text-primary-600 border border-primary-200' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {tab === 'vending' ? 'Vending' : tab === 'sops' ? 'SOPs' : tab.charAt(0).toUpperCase() + tab.slice(1)}
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
                  {sopCategoriesData.map((category) => {
                    const Icon = FileText // Default icon
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
                    {deliveriesData.filter(d => d.status === 'in-transit').length} in progress
                  </span>
                </div>
              </div>
              <div className="divide-y">
                {deliveriesData.map((delivery) => (
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
                  {maintenanceData.map((task) => (
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

            {/* Activity Feed */}
            <ActivityFeed limit={5} />
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
              <p className="mt-1 text-xs opacity-75">
                Version {process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'} • 
                {process.env.NEXT_PUBLIC_BUILD_DATE ? ` Built ${process.env.NEXT_PUBLIC_BUILD_DATE}` : ''}
              </p>
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
      <ClientDetailModal
        isOpen={isClientDetailModalOpen}
        onClose={handleCloseClientDetailModal}
        client={selectedClient}
        onClientUpdated={handleClientUpdated}
        initialEditing={clientModalEditMode}
      />
      <VendingMachineDetailModal
        isOpen={isVendingMachineModalOpen}
        onClose={handleCloseVendingMachineModal}
        machine={selectedVendingMachine}
        onMachineUpdated={handleVendingMachineUpdated}
      />
      
      {/* Form Modals */}
      <VehicleFormModal
        isOpen={isVehicleFormOpen}
        onClose={() => setIsVehicleFormOpen(false)}
        onSubmit={handleVehicleFormSubmit}
        vehicle={editingVehicle}
      />
      <DeliveryFormModal
        isOpen={isDeliveryFormOpen}
        onClose={() => setIsDeliveryFormOpen(false)}
        onSubmit={handleDeliveryFormSubmit}
        delivery={editingDelivery}
        clients={clients}
        vehicles={vehiclesData}
      />
      <MaintenanceTaskFormModal
        isOpen={isMaintenanceFormOpen}
        onClose={() => setIsMaintenanceFormOpen(false)}
        onSubmit={handleMaintenanceFormSubmit}
        task={editingMaintenanceTask}
        vehicles={vehiclesData}
      />
      <SOPCategoryFormModal
        isOpen={isSOPCategoryFormOpen}
        onClose={() => setIsSOPCategoryFormOpen(false)}
        onSubmit={handleSOPCategoryFormSubmit}
        category={editingSOPCategory}
      />
      <ClientFormModal
        isOpen={isClientFormOpen}
        onClose={() => setIsClientFormOpen(false)}
        onSubmit={handleClientFormSubmit}
        client={editingClient}
      />
      <VendingMachineFormModal
        isOpen={isVendingMachineFormOpen}
        onClose={() => setIsVendingMachineFormOpen(false)}
        onSubmit={handleVendingMachineFormSubmit}
        machine={editingVendingMachine}
      />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={handleCloseConfirmModal}
        onConfirm={() => {
          confirmModal.onConfirm()
          handleCloseConfirmModal()
        }}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
      />

      {/* New UX Components */}
      <NotificationsCenter
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onAddVehicle={() => {
          setEditingVehicle(null)
          setIsVehicleFormOpen(true)
        }}
        onAddDelivery={() => {
          setEditingDelivery(null)
          setIsDeliveryFormOpen(true)
        }}
        onAddClient={() => {
          setEditingClient(null)
          setIsClientFormOpen(true)
        }}
        onAddMaintenance={() => {
          setEditingMaintenanceTask(null)
          setIsMaintenanceFormOpen(true)
        }}
      />
      <KeyboardShortcutsHelp
        isOpen={isKeyboardShortcutsOpen}
        onClose={() => setIsKeyboardShortcutsOpen(false)}
      />
      <QuickActions
        onAddVehicle={() => {
          setEditingVehicle(null)
          setIsVehicleFormOpen(true)
        }}
        onAddDelivery={() => {
          setEditingDelivery(null)
          setIsDeliveryFormOpen(true)
        }}
        onAddClient={() => {
          setEditingClient(null)
          setIsClientFormOpen(true)
        }}
        onAddMaintenance={() => {
          setEditingMaintenanceTask(null)
          setIsMaintenanceFormOpen(true)
        }}
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
export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getServerSession(context.req, context.res, authOptions)
  if (!session) {
    return {
      redirect: {
        destination: '/auth/login',
        permanent: false,
      },
    }
  }
  return { props: {} }
}
