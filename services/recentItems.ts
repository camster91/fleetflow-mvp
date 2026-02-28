// Recent Items Service for Smart Autofill
// Stores recently used values in localStorage for quick access

const STORAGE_KEY = 'fleetflow-recent-items'
const MAX_ITEMS = 20

export interface RecentItems {
  // Vehicles
  vehicleNames: string[]
  vehicleTypes: string[]
  drivers: string[]
  locations: string[]
  licensePlates: string[]
  maintenanceTypes: string[]
  
  // Deliveries
  customerNames: string[]
  addresses: string[]
  contactNames: string[]
  contactPhones: string[]
  contactEmails: string[]
  
  // Clients
  clientBusinessNames: string[]
  clientTypes: string[]
  
  // Vending Machines
  machineLocations: string[]
  machineTypes: string[]
}

const defaultItems: RecentItems = {
  vehicleNames: [],
  vehicleTypes: [],
  drivers: [],
  locations: [],
  licensePlates: [],
  maintenanceTypes: [],
  customerNames: [],
  addresses: [],
  contactNames: [],
  contactPhones: [],
  contactEmails: [],
  clientBusinessNames: [],
  clientTypes: [],
  machineLocations: [],
  machineTypes: []
}

// Get recent items from localStorage
export const getRecentItems = (): RecentItems => {
  if (typeof window === 'undefined') return defaultItems
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...defaultItems, ...JSON.parse(stored) }
    }
  } catch (error) {
    console.error('Error loading recent items:', error)
  }
  
  return defaultItems
}

// Save recent items to localStorage
const saveRecentItems = (items: RecentItems) => {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch (error) {
    console.error('Error saving recent items:', error)
  }
}

// Add item to a category (keeps unique, moves to top)
const addToCategory = (
  items: RecentItems,
  category: keyof RecentItems,
  value: string
): RecentItems => {
  if (!value || value.trim() === '') return items
  
  const trimmed = value.trim()
  const current = items[category]
  
  // Remove if exists (to move to top)
  const filtered = current.filter(item => 
    item.toLowerCase() !== trimmed.toLowerCase()
  )
  
  // Add to beginning
  const updated = [trimmed, ...filtered].slice(0, MAX_ITEMS)
  
  return { ...items, [category]: updated }
}

// Add vehicle-related items
export const addRecentVehicle = (vehicle: {
  name?: string
  vehicleType?: string
  driver?: string
  location?: string
  licensePlate?: string
}) => {
  const items = getRecentItems()
  let updated = items
  
  if (vehicle.name) updated = addToCategory(updated, 'vehicleNames', vehicle.name)
  if (vehicle.vehicleType) updated = addToCategory(updated, 'vehicleTypes', vehicle.vehicleType)
  if (vehicle.driver) updated = addToCategory(updated, 'drivers', vehicle.driver)
  if (vehicle.location) updated = addToCategory(updated, 'locations', vehicle.location)
  if (vehicle.licensePlate) updated = addToCategory(updated, 'licensePlates', vehicle.licensePlate)
  
  saveRecentItems(updated)
}

// Add delivery-related items
export const addRecentDelivery = (delivery: {
  customer?: string
  address?: string
  contactName?: string
  contactPhone?: string
  contactEmail?: string
}) => {
  const items = getRecentItems()
  let updated = items
  
  if (delivery.customer) updated = addToCategory(updated, 'customerNames', delivery.customer)
  if (delivery.address) updated = addToCategory(updated, 'addresses', delivery.address)
  if (delivery.contactName) updated = addToCategory(updated, 'contactNames', delivery.contactName)
  if (delivery.contactPhone) updated = addToCategory(updated, 'contactPhones', delivery.contactPhone)
  if (delivery.contactEmail) updated = addToCategory(updated, 'contactEmails', delivery.contactEmail)
  
  saveRecentItems(updated)
}

// Add client-related items
export const addRecentClient = (client: {
  businessName?: string
  name?: string
  type?: string
}) => {
  const items = getRecentItems()
  let updated = items
  
  const displayName = client.businessName || client.name
  if (displayName) updated = addToCategory(updated, 'clientBusinessNames', displayName)
  if (client.type) updated = addToCategory(updated, 'clientTypes', client.type)
  
  saveRecentItems(updated)
}

// Add maintenance-related items
export const addRecentMaintenance = (task: {
  vehicle?: string
  type?: string
}) => {
  const items = getRecentItems()
  let updated = items
  
  if (task.vehicle) updated = addToCategory(updated, 'vehicleNames', task.vehicle)
  if (task.type) updated = addToCategory(updated, 'maintenanceTypes', task.type)
  
  saveRecentItems(updated)
}

// Add vending machine-related items
export const addRecentVendingMachine = (machine: {
  location?: string
  type?: string
}) => {
  const items = getRecentItems()
  let updated = items
  
  if (machine.location) updated = addToCategory(updated, 'machineLocations', machine.location)
  if (machine.type) updated = addToCategory(updated, 'machineTypes', machine.type)
  
  saveRecentItems(updated)
}

// Search/filter recent items
export const searchRecentItems = (
  category: keyof RecentItems,
  query: string
): string[] => {
  const items = getRecentItems()
  const categoryItems = items[category]
  
  if (!query || query.trim() === '') return categoryItems
  
  const lowerQuery = query.toLowerCase()
  return categoryItems.filter(item => 
    item.toLowerCase().includes(lowerQuery)
  )
}

// Clear all recent items
export const clearRecentItems = () => {
  saveRecentItems(defaultItems)
}

// Clear specific category
export const clearRecentCategory = (category: keyof RecentItems) => {
  const items = getRecentItems()
  saveRecentItems({ ...items, [category]: [] })
}
