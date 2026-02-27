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
  vehicleType?: string
  licensePlate?: string
  year?: number
  fuelLevel?: number
  lastService?: string
  nextService?: string
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
  estimatedArrival?: string
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
  specialRequirements?: string[]
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
  estimatedDuration?: string
  partsNeeded?: string[]
  serviceProvider?: string
  costEstimate?: number
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
  type: 'restaurant' | 'hotel' | 'office' | 'retail' | 'warehouse' | 'cafe' | 'institution' | 'other'
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
  businessHours?: string
  securityNotes?: string
  
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

// Vending machine note left by a driver or technician for the next person
export interface VendingMachineNote {
  id: number
  authorName: string
  timestamp: string
  text: string
  category: 'restock' | 'maintenance' | 'access' | 'general'
  resolved: boolean
}

export interface VendingMachine {
  id: number
  name: string           // e.g. "Building A Lobby"
  machineId: string      // physical serial / asset tag
  location: string       // street address or building name
  locationDetail?: string // e.g. "Near main entrance, 2nd floor"
  type: 'snacks' | 'beverages' | 'combo' | 'coffee' | 'fresh-food' | 'other'
  status: 'operational' | 'needs-restock' | 'needs-maintenance' | 'offline'

  // Access
  contactPerson?: ContactPerson
  accessCodes?: string[]
  accessInstructions?: string

  // Coordinates
  primaryLocation?: LocationCoordinates

  // Service tracking
  lastRestockedDate?: string
  lastServiceDate?: string
  nextServiceDue?: string

  // Photos
  photos?: DeliveryPhoto[]

  // Handoff notes — anyone servicing the machine can leave notes for the next person
  notes: VendingMachineNote[]

  created: string
  updated: string
}

// Bump this string whenever you want to wipe old data and re-seed
const DATA_VERSION = 'v3'

const seedVehicles: Vehicle[] = []
const seedClients: Client[] = []
const seedDeliveries: Delivery[] = []
const seedAnnouncements: Announcement[] = []

// Storage keys
const STORAGE_KEYS = {
  VEHICLES: 'fleetflow-vehicles',
  DELIVERIES: 'fleetflow-deliveries',
  SOP_CATEGORIES: 'fleetflow-sop-categories',
  MAINTENANCE_TASKS: 'fleetflow-maintenance-tasks',
  ANNOUNCEMENTS: 'fleetflow-announcements',
  CLIENTS: 'fleetflow-clients',
  VENDING_MACHINES: 'fleetflow-vending-machines',
}

// Initialize data — clears stale data when DATA_VERSION changes
const initializeData = () => {
  if (localStorage.getItem('fleetflow-data-version') !== DATA_VERSION) {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key))
    localStorage.setItem('fleetflow-data-version', DATA_VERSION)
  }
  if (!localStorage.getItem(STORAGE_KEYS.VEHICLES)) {
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(seedVehicles))
  }
  if (!localStorage.getItem(STORAGE_KEYS.DELIVERIES)) {
    localStorage.setItem(STORAGE_KEYS.DELIVERIES, JSON.stringify(seedDeliveries))
  }
  if (!localStorage.getItem(STORAGE_KEYS.SOP_CATEGORIES)) {
    localStorage.setItem(STORAGE_KEYS.SOP_CATEGORIES, JSON.stringify([]))
  }
  if (!localStorage.getItem(STORAGE_KEYS.MAINTENANCE_TASKS)) {
    localStorage.setItem(STORAGE_KEYS.MAINTENANCE_TASKS, JSON.stringify([]))
  }
  if (!localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS)) {
    localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(seedAnnouncements))
  }
  if (!localStorage.getItem(STORAGE_KEYS.CLIENTS)) {
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(seedClients))
  }
  if (!localStorage.getItem(STORAGE_KEYS.VENDING_MACHINES)) {
    localStorage.setItem(STORAGE_KEYS.VENDING_MACHINES, JSON.stringify([]))
  }
}

// Get all data
export const getVehicles = (): Vehicle[] => {
  initializeData()
  const data = localStorage.getItem(STORAGE_KEYS.VEHICLES)
  return data ? JSON.parse(data) : []
}

export const getDeliveries = (): Delivery[] => {
  initializeData()
  const data = localStorage.getItem(STORAGE_KEYS.DELIVERIES)
  return data ? JSON.parse(data) : []
}

export const getSOPCategories = (): SOPCategory[] => {
  initializeData()
  const data = localStorage.getItem(STORAGE_KEYS.SOP_CATEGORIES)
  return data ? JSON.parse(data) : []
}

export const getMaintenanceTasks = (): MaintenanceTask[] => {
  initializeData()
  const data = localStorage.getItem(STORAGE_KEYS.MAINTENANCE_TASKS)
  return data ? JSON.parse(data) : []
}

export const getAnnouncements = (): Announcement[] => {
  initializeData()
  const data = localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS)
  return data ? JSON.parse(data) : []
}

export const getClients = (): Client[] => {
  initializeData()
  const data = localStorage.getItem(STORAGE_KEYS.CLIENTS)
  return data ? JSON.parse(data) : []
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

// CRUD operations for Vending Machines
export const getVendingMachines = (): VendingMachine[] => {
  initializeData()
  const data = localStorage.getItem(STORAGE_KEYS.VENDING_MACHINES)
  return data ? JSON.parse(data) : []
}

export const addVendingMachine = (
  machine: Omit<VendingMachine, 'id' | 'notes' | 'created' | 'updated'>
): VendingMachine => {
  const machines = getVendingMachines()
  const newId = machines.length > 0 ? Math.max(...machines.map(m => m.id)) + 1 : 1
  const now = new Date().toISOString()
  const newMachine: VendingMachine = {
    ...machine,
    id: newId,
    notes: [],
    created: now,
    updated: now,
  }
  localStorage.setItem(STORAGE_KEYS.VENDING_MACHINES, JSON.stringify([...machines, newMachine]))
  return newMachine
}

export const updateVendingMachine = (
  id: number,
  updates: Partial<Omit<VendingMachine, 'id' | 'created'>>
): VendingMachine | null => {
  const machines = getVendingMachines()
  const index = machines.findIndex(m => m.id === id)
  if (index === -1) return null
  const updated = { ...machines[index], ...updates, updated: new Date().toISOString() }
  machines[index] = updated
  localStorage.setItem(STORAGE_KEYS.VENDING_MACHINES, JSON.stringify(machines))
  return updated
}

export const deleteVendingMachine = (id: number): boolean => {
  const machines = getVendingMachines()
  const filtered = machines.filter(m => m.id !== id)
  if (filtered.length === machines.length) return false
  localStorage.setItem(STORAGE_KEYS.VENDING_MACHINES, JSON.stringify(filtered))
  return true
}

export const addVendingMachineNote = (
  machineId: number,
  note: Omit<VendingMachineNote, 'id' | 'timestamp' | 'resolved'>
): VendingMachine | null => {
  const machines = getVendingMachines()
  const index = machines.findIndex(m => m.id === machineId)
  if (index === -1) return null
  const notes = machines[index].notes
  const newNote: VendingMachineNote = {
    ...note,
    id: notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1,
    timestamp: new Date().toISOString(),
    resolved: false,
  }
  machines[index] = {
    ...machines[index],
    notes: [newNote, ...machines[index].notes],
    updated: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEYS.VENDING_MACHINES, JSON.stringify(machines))
  return machines[index]
}

export const resolveVendingMachineNote = (machineId: number, noteId: number): VendingMachine | null => {
  const machines = getVendingMachines()
  const index = machines.findIndex(m => m.id === machineId)
  if (index === -1) return null
  machines[index] = {
    ...machines[index],
    notes: machines[index].notes.map(n => n.id === noteId ? { ...n, resolved: true } : n),
    updated: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEYS.VENDING_MACHINES, JSON.stringify(machines))
  return machines[index]
}

export const deleteVendingMachineNote = (machineId: number, noteId: number): VendingMachine | null => {
  const machines = getVendingMachines()
  const index = machines.findIndex(m => m.id === machineId)
  if (index === -1) return null
  machines[index] = {
    ...machines[index],
    notes: machines[index].notes.filter(n => n.id !== noteId),
    updated: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEYS.VENDING_MACHINES, JSON.stringify(machines))
  return machines[index]
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

// Reset to seed data
export const resetToDefault = () => {
  localStorage.removeItem('fleetflow-data-version')
  initializeData()
  return true
}