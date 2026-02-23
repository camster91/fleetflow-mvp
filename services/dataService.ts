// Data service for FleetFlow Pro
// Uses localStorage for persistence

// Types
export interface Vehicle {
  id: number
  name: string
  status: 'active' | 'inactive' | 'delayed'
  driver: string
  location: string
  eta: string
  mileage: number
  maintenanceDue: boolean
  lastUpdated?: string
}

export interface LocationCoordinates {
  lat: number
  lng: number
  address?: string
  notes?: string
}

export interface ContactPerson {
  name: string
  phone?: string
  email?: string
  department?: string
  availability?: string
}

export interface DeliveryPhoto {
  id: string
  url: string
  caption?: string
  timestamp: string
  uploadedBy: string
}

export interface Delivery {
  id: number
  address: string
  customer: string
  status: 'pending' | 'in-transit' | 'delivered' | 'cancelled'
  driver: string
  items: number
  progress: number
  notes?: string
  scheduledTime?: string
  completedTime?: string
  
  // Location details for drivers
  parkingLocation?: LocationCoordinates
  dropoffLocation?: LocationCoordinates
  parkingInstructions?: string
  dropoffInstructions?: string
  
  // Contact information
  contactPerson?: ContactPerson
  
  // Visual references
  photos?: DeliveryPhoto[]
  
  // Access information
  accessCodes?: string[]
  securityNotes?: string
  businessHours?: string
}

export interface SOPCategory {
  id: number
  name: string
  count: number
  description?: string
  lastUpdated?: string
}

export interface MaintenanceTask {
  id: number
  vehicle: string
  type: string
  dueDate: string
  priority: 'high' | 'medium' | 'low'
  completed?: boolean
  completedDate?: string
  notes?: string
}

export interface Announcement {
  id: number
  message: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  recipients: string
  timestamp: string
  readBy?: string[]
}

// Client database for dispatchers
export interface Client {
  id: number
  name: string
  businessName?: string
  type: 'restaurant' | 'hotel' | 'office' | 'retail' | 'warehouse' | 'other'
  address: string
  contactPerson?: ContactPerson
  phone?: string
  email?: string
  website?: string
  
  // Delivery preferences
  preferredDeliveryTimes?: string[]
  parkingInstructions?: string
  dropoffInstructions?: string
  accessCodes?: string[]
  specialRequirements?: string[]
  
  // Notes and history
  notes?: string
  lastDeliveryDate?: string
  deliveryFrequency?: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'as-needed'
  rating?: 1 | 2 | 3 | 4 | 5
  
  // Location data
  primaryLocation?: LocationCoordinates
  parkingLocation?: LocationCoordinates
  dropoffLocation?: LocationCoordinates
  
  // Photos
  locationPhotos?: DeliveryPhoto[]
  
  created: string
  updated: string
}

// Default data
const defaultVehicles: Vehicle[] = [
  { id: 1, name: 'Food Truck 1', status: 'active', driver: 'John D.', location: 'Downtown', eta: '10 min', mileage: 45230, maintenanceDue: false },
  { id: 2, name: 'Van 2', status: 'active', driver: 'Sarah M.', location: 'East Side', eta: '25 min', mileage: 38920, maintenanceDue: true },
  { id: 3, name: 'Truck 3', status: 'inactive', driver: 'Mike R.', location: 'Depot', eta: 'N/A', mileage: 51200, maintenanceDue: false },
  { id: 4, name: 'Van 4', status: 'delayed', driver: 'Alex T.', location: 'West End', eta: '45 min', mileage: 42100, maintenanceDue: true },
]

const defaultDeliveries: Delivery[] = [
  { id: 1, address: '123 Main St', customer: 'Restaurant A', status: 'in-transit', driver: 'John D.', items: 15, progress: 65 },
  { id: 2, address: '456 Oak Ave', customer: 'Cafe B', status: 'pending', driver: 'Sarah M.', items: 8, progress: 0 },
  { id: 3, address: '789 Pine Rd', customer: 'Hotel C', status: 'delivered', driver: 'Mike R.', items: 22, progress: 100 },
  { id: 4, address: '321 Elm St', customer: 'Office D', status: 'in-transit', driver: 'Alex T.', items: 12, progress: 30 },
]

const defaultSOPCategories: SOPCategory[] = [
  { id: 1, name: 'Delivery Procedures', count: 12 },
  { id: 2, name: 'Vehicle Maintenance', count: 8 },
  { id: 3, name: 'Safety Protocols', count: 6 },
  { id: 4, name: 'Customer Service', count: 10 },
]

const defaultMaintenanceTasks: MaintenanceTask[] = [
  { id: 1, vehicle: 'Van 2', type: 'Oil Change', dueDate: '2026-02-25', priority: 'high' },
  { id: 2, vehicle: 'Van 4', type: 'Brake Inspection', dueDate: '2026-02-28', priority: 'medium' },
  { id: 3, vehicle: 'Food Truck 1', type: 'Tire Rotation', dueDate: '2026-03-05', priority: 'low' },
]

const defaultClients: Client[] = [
  {
    id: 1,
    name: 'Restaurant A',
    businessName: 'Downtown Bistro',
    type: 'restaurant',
    address: '123 Main St, Cityville, ST 12345',
    contactPerson: { name: 'John Smith', phone: '(555) 123-4567', email: 'john@restauranta.com' },
    phone: '(555) 123-4567',
    email: 'info@restauranta.com',
    website: 'www.restauranta.com',
    preferredDeliveryTimes: ['10:00-11:00 AM', '2:00-3:00 PM'],
    parkingInstructions: 'Use back alley parking lot',
    dropoffInstructions: 'Deliver to back kitchen door',
    accessCodes: ['#1234 for back door'],
    specialRequirements: ['No delivery after 4 PM', 'Call upon arrival'],
    notes: 'Excellent customer, always tips drivers',
    lastDeliveryDate: '2026-02-20',
    deliveryFrequency: 'daily',
    rating: 5,
    primaryLocation: { lat: 40.7128, lng: -74.0060, address: '123 Main St' },
    parkingLocation: { lat: 40.7127, lng: -74.0061, notes: 'Back alley parking' },
    dropoffLocation: { lat: 40.7128, lng: -74.0059, notes: 'Kitchen entrance' },
    locationPhotos: [],
    created: '2026-01-15',
    updated: '2026-02-20'
  },
  {
    id: 2,
    name: 'Hotel C',
    businessName: 'Grand Hotel & Suites',
    type: 'hotel',
    address: '789 Pine Rd, Townsville, ST 67890',
    contactPerson: { name: 'Maria Garcia', phone: '(555) 987-6543', email: 'maria@grandhotel.com' },
    phone: '(555) 987-6543',
    email: 'receiving@grandhotel.com',
    website: 'www.grandhotel.com',
    preferredDeliveryTimes: ['8:00-10:00 AM', '3:00-5:00 PM'],
    parkingInstructions: 'Use loading dock at rear',
    dropoffInstructions: 'Deliver to receiving department, basement level',
    accessCodes: ['Call extension 345 for receiving'],
    specialRequirements: ['Must check in with security', 'Use service elevator'],
    notes: 'Large deliveries every Monday',
    lastDeliveryDate: '2026-02-22',
    deliveryFrequency: 'weekly',
    rating: 4,
    primaryLocation: { lat: 40.7580, lng: -73.9855, address: '789 Pine Rd' },
    parkingLocation: { lat: 40.7579, lng: -73.9856, notes: 'Loading dock area' },
    dropoffLocation: { lat: 40.7580, lng: -73.9854, notes: 'Basement receiving' },
    locationPhotos: [],
    created: '2026-01-20',
    updated: '2026-02-22'
  },
  {
    id: 3,
    name: 'Office D',
    businessName: 'TechCorp Headquarters',
    type: 'office',
    address: '321 Elm St, Tech Park, ST 54321',
    contactPerson: { name: 'David Chen', phone: '(555) 456-7890', email: 'david@techcorp.com' },
    phone: '(555) 456-7890',
    email: 'facilities@techcorp.com',
    website: 'www.techcorp.com',
    preferredDeliveryTimes: ['9:00 AM-12:00 PM'],
    parkingInstructions: 'Visitor parking, level P2',
    dropoffInstructions: 'Front desk, building lobby',
    accessCodes: ['Badge required for parking garage'],
    specialRequirements: ['Security clearance needed', 'Must sign in at front desk'],
    notes: 'New client, first delivery scheduled',
    lastDeliveryDate: '2026-02-18',
    deliveryFrequency: 'as-needed',
    rating: 3,
    primaryLocation: { lat: 40.7420, lng: -74.0040, address: '321 Elm St' },
    parkingLocation: { lat: 40.7419, lng: -74.0041, notes: 'Visitor parking P2' },
    dropoffLocation: { lat: 40.7421, lng: -74.0039, notes: 'Main lobby' },
    locationPhotos: [],
    created: '2026-02-10',
    updated: '2026-02-18'
  },
  {
    id: 4,
    name: 'Cafe B',
    businessName: 'Morning Brew Cafe',
    type: 'restaurant',
    address: '456 Oak Ave, Village Center, ST 45678',
    contactPerson: { name: 'Sarah Johnson', phone: '(555) 234-5678', email: 'sarah@morningbrew.com' },
    phone: '(555) 234-5678',
    email: 'orders@morningbrew.com',
    website: 'www.morningbrew.com',
    preferredDeliveryTimes: ['7:00-8:00 AM', '1:00-2:00 PM'],
    parkingInstructions: 'Street parking only, 15-minute limit',
    dropoffInstructions: 'Side entrance next to dumpster',
    accessCodes: ['Knock on metal door 3 times'],
    specialRequirements: ['Quiet delivery before 8 AM', 'No horn honking'],
    notes: 'Early morning deliveries only',
    lastDeliveryDate: '2026-02-21',
    deliveryFrequency: 'daily',
    rating: 5,
    primaryLocation: { lat: 40.7282, lng: -74.0030, address: '456 Oak Ave' },
    parkingLocation: { lat: 40.7281, lng: -74.0031, notes: 'Street parking zone' },
    dropoffLocation: { lat: 40.7283, lng: -74.0029, notes: 'Side alley entrance' },
    locationPhotos: [],
    created: '2026-01-25',
    updated: '2026-02-21'
  }
]

// Storage keys
const STORAGE_KEYS = {
  VEHICLES: 'fleetflow-vehicles',
  DELIVERIES: 'fleetflow-deliveries',
  SOP_CATEGORIES: 'fleetflow-sop-categories',
  MAINTENANCE_TASKS: 'fleetflow-maintenance-tasks',
  ANNOUNCEMENTS: 'fleetflow-announcements',
  CLIENTS: 'fleetflow-clients',
}

// Initialize data
const initializeData = () => {
  if (!localStorage.getItem(STORAGE_KEYS.VEHICLES)) {
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(defaultVehicles))
  }
  if (!localStorage.getItem(STORAGE_KEYS.DELIVERIES)) {
    localStorage.setItem(STORAGE_KEYS.DELIVERIES, JSON.stringify(defaultDeliveries))
  }
  if (!localStorage.getItem(STORAGE_KEYS.SOP_CATEGORIES)) {
    localStorage.setItem(STORAGE_KEYS.SOP_CATEGORIES, JSON.stringify(defaultSOPCategories))
  }
  if (!localStorage.getItem(STORAGE_KEYS.MAINTENANCE_TASKS)) {
    localStorage.setItem(STORAGE_KEYS.MAINTENANCE_TASKS, JSON.stringify(defaultMaintenanceTasks))
  }
  if (!localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS)) {
    localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify([]))
  }
  if (!localStorage.getItem(STORAGE_KEYS.CLIENTS)) {
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(defaultClients))
  }
}

// Get all data
export const getVehicles = (): Vehicle[] => {
  initializeData()
  const data = localStorage.getItem(STORAGE_KEYS.VEHICLES)
  return data ? JSON.parse(data) : defaultVehicles
}

export const getDeliveries = (): Delivery[] => {
  initializeData()
  const data = localStorage.getItem(STORAGE_KEYS.DELIVERIES)
  return data ? JSON.parse(data) : defaultDeliveries
}

export const getSOPCategories = (): SOPCategory[] => {
  initializeData()
  const data = localStorage.getItem(STORAGE_KEYS.SOP_CATEGORIES)
  return data ? JSON.parse(data) : defaultSOPCategories
}

export const getMaintenanceTasks = (): MaintenanceTask[] => {
  initializeData()
  const data = localStorage.getItem(STORAGE_KEYS.MAINTENANCE_TASKS)
  return data ? JSON.parse(data) : defaultMaintenanceTasks
}

export const getAnnouncements = (): Announcement[] => {
  initializeData()
  const data = localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS)
  return data ? JSON.parse(data) : []
}

export const getClients = (): Client[] => {
  initializeData()
  const data = localStorage.getItem(STORAGE_KEYS.CLIENTS)
  return data ? JSON.parse(data) : defaultClients
}

// CRUD operations for Vehicles
export const addVehicle = (vehicle: Omit<Vehicle, 'id'>): Vehicle => {
  const vehicles = getVehicles()
  const newId = vehicles.length > 0 ? Math.max(...vehicles.map(v => v.id)) + 1 : 1
  const newVehicle: Vehicle = {
    ...vehicle,
    id: newId,
    lastUpdated: new Date().toISOString(),
  }
  const updatedVehicles = [...vehicles, newVehicle]
  localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(updatedVehicles))
  return newVehicle
}

export const updateVehicle = (id: number, updates: Partial<Vehicle>): Vehicle | null => {
  const vehicles = getVehicles()
  const index = vehicles.findIndex(v => v.id === id)
  if (index === -1) return null
  
  const updatedVehicle = {
    ...vehicles[index],
    ...updates,
    lastUpdated: new Date().toISOString(),
  }
  vehicles[index] = updatedVehicle
  localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles))
  return updatedVehicle
}

export const deleteVehicle = (id: number): boolean => {
  const vehicles = getVehicles()
  const filtered = vehicles.filter(v => v.id !== id)
  if (filtered.length === vehicles.length) return false
  
  localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(filtered))
  return true
}

// CRUD operations for Deliveries
export const addDelivery = (delivery: Omit<Delivery, 'id'>): Delivery => {
  const deliveries = getDeliveries()
  const newId = deliveries.length > 0 ? Math.max(...deliveries.map(d => d.id)) + 1 : 1
  const newDelivery: Delivery = {
    ...delivery,
    id: newId,
  }
  const updatedDeliveries = [...deliveries, newDelivery]
  localStorage.setItem(STORAGE_KEYS.DELIVERIES, JSON.stringify(updatedDeliveries))
  return newDelivery
}

export const updateDelivery = (id: number, updates: Partial<Delivery>): Delivery | null => {
  const deliveries = getDeliveries()
  const index = deliveries.findIndex(d => d.id === id)
  if (index === -1) return null
  
  const updatedDelivery = {
    ...deliveries[index],
    ...updates,
  }
  deliveries[index] = updatedDelivery
  localStorage.setItem(STORAGE_KEYS.DELIVERIES, JSON.stringify(deliveries))
  return updatedDelivery
}

export const deleteDelivery = (id: number): boolean => {
  const deliveries = getDeliveries()
  const filtered = deliveries.filter(d => d.id !== id)
  if (filtered.length === deliveries.length) return false
  
  localStorage.setItem(STORAGE_KEYS.DELIVERIES, JSON.stringify(filtered))
  return true
}

// CRUD operations for SOP Categories
export const addSOPCategory = (category: Omit<SOPCategory, 'id'>): SOPCategory => {
  const categories = getSOPCategories()
  const newId = categories.length > 0 ? Math.max(...categories.map(c => c.id)) + 1 : 1
  const newCategory: SOPCategory = {
    ...category,
    id: newId,
    lastUpdated: new Date().toISOString(),
  }
  const updatedCategories = [...categories, newCategory]
  localStorage.setItem(STORAGE_KEYS.SOP_CATEGORIES, JSON.stringify(updatedCategories))
  return newCategory
}

export const updateSOPCategory = (id: number, updates: Partial<SOPCategory>): SOPCategory | null => {
  const categories = getSOPCategories()
  const index = categories.findIndex(c => c.id === id)
  if (index === -1) return null
  
  const updatedCategory = {
    ...categories[index],
    ...updates,
    lastUpdated: new Date().toISOString(),
  }
  categories[index] = updatedCategory
  localStorage.setItem(STORAGE_KEYS.SOP_CATEGORIES, JSON.stringify(categories))
  return updatedCategory
}

export const deleteSOPCategory = (id: number): boolean => {
  const categories = getSOPCategories()
  const filtered = categories.filter(c => c.id !== id)
  if (filtered.length === categories.length) return false
  
  localStorage.setItem(STORAGE_KEYS.SOP_CATEGORIES, JSON.stringify(filtered))
  return true
}

// CRUD operations for Maintenance Tasks
export const addMaintenanceTask = (task: Omit<MaintenanceTask, 'id'>): MaintenanceTask => {
  const tasks = getMaintenanceTasks()
  const newId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1
  const newTask: MaintenanceTask = {
    ...task,
    id: newId,
  }
  const updatedTasks = [...tasks, newTask]
  localStorage.setItem(STORAGE_KEYS.MAINTENANCE_TASKS, JSON.stringify(updatedTasks))
  return newTask
}

export const updateMaintenanceTask = (id: number, updates: Partial<MaintenanceTask>): MaintenanceTask | null => {
  const tasks = getMaintenanceTasks()
  const index = tasks.findIndex(t => t.id === id)
  if (index === -1) return null
  
  const updatedTask = {
    ...tasks[index],
    ...updates,
  }
  tasks[index] = updatedTask
  localStorage.setItem(STORAGE_KEYS.MAINTENANCE_TASKS, JSON.stringify(tasks))
  return updatedTask
}

export const deleteMaintenanceTask = (id: number): boolean => {
  const tasks = getMaintenanceTasks()
  const filtered = tasks.filter(t => t.id !== id)
  if (filtered.length === tasks.length) return false
  
  localStorage.setItem(STORAGE_KEYS.MAINTENANCE_TASKS, JSON.stringify(filtered))
  return true
}

// Announcements
export const addAnnouncement = (announcement: Omit<Announcement, 'id' | 'timestamp'>): Announcement => {
  const announcements = getAnnouncements()
  const newId = announcements.length > 0 ? Math.max(...announcements.map(a => a.id)) + 1 : 1
  const newAnnouncement: Announcement = {
    ...announcement,
    id: newId,
    timestamp: new Date().toISOString(),
  }
  const updatedAnnouncements = [...announcements, newAnnouncement]
  localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(updatedAnnouncements))
  return newAnnouncement
}

// CRUD operations for Clients
export const addClient = (client: Omit<Client, 'id' | 'created' | 'updated'>): Client => {
  const clients = getClients()
  const newId = clients.length > 0 ? Math.max(...clients.map(c => c.id)) + 1 : 1
  const now = new Date().toISOString()
  const newClient: Client = {
    ...client,
    id: newId,
    created: now,
    updated: now,
  }
  const updatedClients = [...clients, newClient]
  localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(updatedClients))
  return newClient
}

export const updateClient = (id: number, updates: Partial<Omit<Client, 'id' | 'created'>>): Client | null => {
  const clients = getClients()
  const index = clients.findIndex(c => c.id === id)
  if (index === -1) return null
  
  const updatedClient = {
    ...clients[index],
    ...updates,
    updated: new Date().toISOString(),
  }
  clients[index] = updatedClient
  localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients))
  return updatedClient
}

export const deleteClient = (id: number): boolean => {
  const clients = getClients()
  const filtered = clients.filter(c => c.id !== id)
  if (filtered.length === clients.length) return false
  
  localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(filtered))
  return true
}

export const searchClients = (query: string): Client[] => {
  const clients = getClients()
  const lowerQuery = query.toLowerCase()
  return clients.filter(client => 
    client.name.toLowerCase().includes(lowerQuery) ||
    client.businessName?.toLowerCase().includes(lowerQuery) ||
    client.address.toLowerCase().includes(lowerQuery) ||
    client.contactPerson?.name.toLowerCase().includes(lowerQuery) ||
    client.type.toLowerCase().includes(lowerQuery)
  )
}

export const getClientById = (id: number): Client | null => {
  const clients = getClients()
  return clients.find(client => client.id === id) || null
}

// Statistics
export const getStats = () => {
  const vehicles = getVehicles()
  const deliveries = getDeliveries()
  const tasks = getMaintenanceTasks()
  const categories = getSOPCategories()
  
  return {
    activeVehicles: vehicles.filter(v => v.status === 'active').length,
    totalVehicles: vehicles.length,
    todaysDeliveries: deliveries.filter(d => d.status === 'in-transit' || d.status === 'pending').length,
    totalDeliveries: deliveries.length,
    pendingSOPs: categories.reduce((sum, cat) => sum + cat.count, 0),
    maintenanceDue: tasks.filter(t => !t.completed && new Date(t.dueDate) <= new Date()).length,
    totalMaintenanceTasks: tasks.length,
  }
}

// Reset to default (for testing)
export const resetToDefault = () => {
  localStorage.removeItem(STORAGE_KEYS.VEHICLES)
  localStorage.removeItem(STORAGE_KEYS.DELIVERIES)
  localStorage.removeItem(STORAGE_KEYS.SOP_CATEGORIES)
  localStorage.removeItem(STORAGE_KEYS.MAINTENANCE_TASKS)
  localStorage.removeItem(STORAGE_KEYS.ANNOUNCEMENTS)
  localStorage.removeItem(STORAGE_KEYS.CLIENTS)
  initializeData()
  return true
}