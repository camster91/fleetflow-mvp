/**
 * API-backed data service.
 * Replaces the localStorage-based dataService.
 * All data is shared across users (single-tenant fleet data).
 */
import type {
  Vehicle, Delivery, MaintenanceTask, Client,
  SOPCategory, VendingMachine, Announcement,
} from '../lib/fleet'

export type {
  Vehicle, Delivery, MaintenanceTask, Client,
  SOPCategory, VendingMachine, Announcement,
  LocationCoordinates, ContactPerson, DeliveryPhoto, VendingMachineNote, ActivityItem,
} from '../lib/fleet'

// ─── Generic fetch helpers ────────────────────────────────────────────────────

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    // Prefer stable client-facing messages; avoid leaking raw backend/provider text
    const statusMessages: Record<number, string> = {
      400: 'Invalid request',
      401: 'Please sign in again',
      403: 'You do not have permission to do that',
      404: 'Not found',
      429: 'Too many requests — try again shortly',
      500: 'Something went wrong — please try again',
    }
    const safe =
      statusMessages[res.status] ||
      (typeof err?.error === 'string' && err.error.length < 120 && !/exception|stack|ECONN|prisma|sql/i.test(err.error)
        ? err.error
        : `Request failed (${res.status})`)
    throw new Error(safe)
  }
  return res.json()
}

const get = <T>(url: string) => apiFetch<T>(url)
type CollectionResponse<T> = T[] | { data: T[]; hasMore?: boolean }
// List APIs cap `limit` at 200 and default to 50; page through every page so
// fleets with more than one page of records see all of them.
export const COLLECTION_PAGE_SIZE = 200
export const COLLECTION_MAX_PAGES = 50
export const getCollection = async <T>(url: string): Promise<T[]> => {
  const rows: T[] = []
  const seen = new Set<unknown>()
  const separator = url.includes('?') ? '&' : '?'
  for (let page = 1; page <= COLLECTION_MAX_PAGES; page++) {
    const response = await get<CollectionResponse<T>>(`${url}${separator}page=${page}&limit=${COLLECTION_PAGE_SIZE}`)
    if (Array.isArray(response)) return response
    // A row inserted mid-scan can shift offsets; skip ids we've already seen.
    for (const row of response.data) {
      const id = (row as { id?: unknown })?.id
      if (id !== undefined && seen.has(id)) continue
      if (id !== undefined) seen.add(id)
      rows.push(row)
    }
    if (!response.hasMore || response.data.length === 0) return rows
  }
  console.warn(`getCollection(${url}) stopped after ${COLLECTION_MAX_PAGES} pages`)
  return rows
}
const post = <T>(url: string, body: unknown) => apiFetch<T>(url, { method: 'POST', body: JSON.stringify(body) })

// ─── Idempotent creates ───────────────────────────────────────────────────────

export const CREATE_NETWORK_RETRIES = 2
const CREATE_RETRY_DELAY_MS = 300

export const newIdempotencyKey = (): string => {
  const c = globalThis.crypto
  if (typeof c?.randomUUID === 'function') return c.randomUUID()
  const bytes = new Uint8Array(16)
  if (typeof c?.getRandomValues === 'function') c.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * POST for create endpoints. Each call is one submit attempt with its own
 * Idempotency-Key. If the request fails at the network level (the response is
 * unknown), it is retried with the same key so the server replays the first
 * result instead of creating a duplicate. HTTP errors are not retried.
 */
const create = async <T>(url: string, body: unknown): Promise<T> => {
  const init: RequestInit = { method: 'POST', body: JSON.stringify(body), headers: { 'Idempotency-Key': newIdempotencyKey() } }
  for (let attempt = 0; ; attempt++) {
    try {
      return await apiFetch<T>(url, init)
    } catch (error) {
      // fetch() rejects with a TypeError only for network failures.
      if (!(error instanceof TypeError) || attempt >= CREATE_NETWORK_RETRIES) throw error
      await new Promise(resolve => setTimeout(resolve, CREATE_RETRY_DELAY_MS * 2 ** attempt))
    }
  }
}
const put = <T>(url: string, body: unknown) => apiFetch<T>(url, { method: 'PUT', body: JSON.stringify(body) })
const del = <T>(url: string) => apiFetch<T>(url, { method: 'DELETE' })

// ─── Vehicles ─────────────────────────────────────────────────────────────────

export const getVehicles = () => getCollection<Vehicle>('/api/vehicles')
export const addVehicle = (v: Omit<Vehicle, 'id'>) => create<Vehicle>('/api/vehicles', v)
export const updateVehicle = (id: string, v: Partial<Vehicle>) => put<Vehicle>(`/api/vehicles/${id}`, v)
export const deleteVehicle = (id: string) => del<{ success: boolean }>(`/api/vehicles/${id}`)
export interface DriverOption { id:string; name:string; label:string }
export const getDrivers = async () => (await get<{drivers:DriverOption[]}>('/api/drivers')).drivers

// ─── Deliveries ───────────────────────────────────────────────────────────────

export const getDeliveries = () => getCollection<Delivery>('/api/deliveries')
export const addDelivery = (d: Omit<Delivery, 'id'>) => create<Delivery>('/api/deliveries', d)
export const updateDelivery = (id: string, d: Partial<Delivery>) => put<Delivery>(`/api/deliveries/${id}`, d)
export const deleteDelivery = (id: string) => del<{ success: boolean }>(`/api/deliveries/${id}`)

// ─── Maintenance ──────────────────────────────────────────────────────────────

export const getMaintenanceTasks = () => getCollection<MaintenanceTask>('/api/maintenance')
export const addMaintenanceTask = (t: Omit<MaintenanceTask, 'id'>) => create<MaintenanceTask>('/api/maintenance', t)
export const updateMaintenanceTask = (id: string, t: Partial<MaintenanceTask>) =>
  put<MaintenanceTask>(`/api/maintenance/${id}`, t)
export const deleteMaintenanceTask = (id: string) => del<{ success: boolean }>(`/api/maintenance/${id}`)

// ─── Clients ──────────────────────────────────────────────────────────────────

export const getClients = () => getCollection<Client>('/api/clients')
export const addClient = (c: Omit<Client, 'id' | 'created' | 'updated'>) => create<Client>('/api/clients', c)
export const updateClient = (id: string, c: Partial<Client>) => put<Client>(`/api/clients/${id}`, c)
export const deleteClient = (id: string) => del<{ success: boolean }>(`/api/clients/${id}`)
export const getClientById = async (id: string) => get<Client>(`/api/clients/${id}`)
export const searchClients = async (query: string): Promise<Client[]> => {
  const clients = await getClients()
  const q = query.toLowerCase()
  return clients.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.businessName?.toLowerCase().includes(q) ||
      c.address.toLowerCase().includes(q) ||
      c.type.toLowerCase().includes(q)
  )
}

// ─── SOP Categories (stored as JSON blob per org for now) ─────────────────────
// ─── SOP Categories ───────────────────────────────────────────────────────────
export const getSOPCategories = () => getCollection<SOPCategory>('/api/sop')
export const addSOPCategory = (cat: Omit<SOPCategory, 'id'>) => post<SOPCategory>('/api/sop', cat)
export const updateSOPCategory = (id: string, data: Partial<SOPCategory>) => put<SOPCategory>(`/api/sop/${id}`, data)
export const deleteSOPCategory = (id: string) => del<{ success: boolean }>(`/api/sop/${id}`)

// ─── Vending Machines ─────────────────────────────────────────────────────────
export const getVendingMachines = () => getCollection<VendingMachine>('/api/vending-machines')
export const addVendingMachine = (vm: Omit<VendingMachine, 'id'>) => post<VendingMachine>('/api/vending-machines', vm)
export const updateVendingMachine = (id: string, data: Partial<VendingMachine>) =>
  put<VendingMachine>(`/api/vending-machines/${id}`, data)
export const deleteVendingMachine = (id: string) => del<{ success: boolean }>(`/api/vending-machines/${id}`)

// ─── Announcements ────────────────────────────────────────────────────────────
export const getAnnouncements = () => get<Announcement[]>('/api/announcements')
export const addAnnouncement = (a: Omit<Announcement, 'id' | 'timestamp'>) =>
  post<Announcement>('/api/announcements', a)
export const deleteAnnouncement = (id: string) => del<{ success: boolean }>(`/api/announcements/${id}`)

// ─── Dashboard stats helper ───────────────────────────────────────────────────
export const getDashboardStats = async () => {
  const [vehicles, deliveries, tasks] = await Promise.all([
    getVehicles().catch(() => [] as Vehicle[]),
    getDeliveries().catch(() => [] as Delivery[]),
    getMaintenanceTasks().catch(() => [] as MaintenanceTask[]),
  ])
  
  return {
    totalVehicles: vehicles.length,
    activeVehicles: vehicles.filter((v) => v.status === 'active').length,
    totalDeliveries: deliveries.length,
    pendingDeliveries: deliveries.filter((d) => d.status === 'pending').length,
    completedDeliveries: deliveries.filter((d) => d.status === 'delivered').length,
    totalMaintenanceTasks: tasks.length,
    pendingMaintenanceTasks: tasks.filter((t) => !t.completed).length,
  }
}
