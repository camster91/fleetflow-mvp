/**
 * Fleet data helpers: DB↔Client conversion and audit logging.
 * Single source of truth for fleet TypeScript types used across API routes.
 */
import type {
  Announcement as DbAnnouncement,
  Client as DbClient,
  MaintenanceTask as DbMaintenanceTask,
  PrismaClient,
  SOPCategory as DbSOPCategory,
  Vehicle as DbVehicle,
  VendingMachine as DbVendingMachine,
} from '@prisma/client'
import { parseDateOnly, toDateOnly } from './dateOnly'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Vehicle {
  id: string
  name: string
  status: 'active' | 'inactive' | 'delayed'
  driver: string
  assignedDriverId?: string | null
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

export interface MaintenanceTask {
  id: string
  vehicle: string        // display name
  vehicleId?: string     // DB id (optional, for linking)
  type: string
  dueDate: string        // YYYY-MM-DD
  priority: 'high' | 'medium' | 'low'
  completed?: boolean
  completedDate?: string
  notes?: string
  estimatedDuration?: string
  partsNeeded?: string[]
  serviceProvider?: string
  costEstimate?: number
}

export interface LocationCoordinates {
  lat: number; lng: number; address?: string; notes?: string
}

export interface ContactPerson {
  name: string; phone?: string; email?: string; department?: string; availability?: string
}

export interface DeliveryPhoto {
  id: string; url: string; caption?: string; timestamp: string; uploadedBy: string
}

export interface Delivery {
  id: string
  address: string
  customer: string
  status: 'pending' | 'in-transit' | 'delivered' | 'cancelled'
  driver: string
  assignedDriverId?: string | null
  items: number
  progress: number
  notes?: string
  scheduledTime?: string
  estimatedArrival?: string
  completedTime?: string
  parkingLocation?: LocationCoordinates
  dropoffLocation?: LocationCoordinates
  parkingInstructions?: string
  dropoffInstructions?: string
  contactPerson?: ContactPerson
  photos?: DeliveryPhoto[]
  accessCodes?: string[]
  securityNotes?: string
  businessHours?: string
  specialRequirements?: string[]
}

export interface Client {
  id: string
  name: string
  businessName?: string
  type: 'restaurant' | 'hotel' | 'office' | 'retail' | 'warehouse' | 'cafe' | 'institution' | 'other'
  address: string
  phone?: string
  email?: string
  website?: string
  businessHours?: string
  notes?: string
  lastDeliveryDate?: string
  deliveryFrequency?: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'as-needed'
  rating?: number
  contactPerson?: ContactPerson
  preferredDeliveryTimes?: string[]
  accessCodes?: string[]
  specialRequirements?: string[]
  primaryLocation?: LocationCoordinates
  parkingLocation?: LocationCoordinates
  dropoffLocation?: LocationCoordinates
  parkingInstructions?: string
  dropoffInstructions?: string
  securityNotes?: string
  locationPhotos?: DeliveryPhoto[]
  created?: string
  updated?: string
}

export interface SOPCategory {
  id: string
  name: string
  count: number
  description?: string
  lastUpdated?: string
}

export interface VendingMachineNote {
  id: string; text: string; author: string; timestamp: string
  type?: 'maintenance' | 'inventory' | 'general'
  priority?: 'low' | 'normal' | 'high'
}

export interface VendingMachine {
  id: string
  name: string
  location: string
  status: 'active' | 'maintenance' | 'out-of-service'
  lastService?: string
  nextService?: string
  machineType?: string
  type: 'snacks' | 'beverages' | 'combo' | 'coffee' | 'fresh-food' | 'other'
  serialNumber?: string
  notes?: string
  driverNotes?: VendingMachineNote[]
  created?: string
  updated?: string
}

export interface Announcement {
  id: string
  message: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  timestamp: string
  read?: boolean
  type?: 'system' | 'maintenance' | 'delivery' | 'general'
  category?: string
  expiresAt?: string
  actionUrl?: string
  actionLabel?: string
}

type NullableFields<T, K extends keyof T> = Omit<Partial<T>, K> & {
  [P in K]?: T[P] | null
}

type SOPCategoryInput = NullableFields<SOPCategory, 'description'>
type VendingMachineInput = NullableFields<
  VendingMachine,
  'machineType' | 'serialNumber' | 'notes' | 'lastService' | 'nextService'
>
type AnnouncementInput = NullableFields<
  Announcement,
  'category' | 'expiresAt' | 'actionUrl' | 'actionLabel'
>

// ─── DB ↔ Client converters ──────────────────────────────────────────────────

export function dbToSOPCategory(db: DbSOPCategory): SOPCategory {
  return {
    id: db.id,
    name: db.name,
    description: db.description ?? undefined,
    count: db.documentCount ?? 0,
    lastUpdated: db.lastUpdated?.toISOString?.() ?? db.updatedAt?.toISOString?.(),
  }
}

export function sopCategoryToDb(cat: SOPCategoryInput, ownerId: string) {
  return {
    name: cat.name!,
    description: cat.description ?? null,
    documentCount: cat.count ?? 0,
    ownerId,
  }
}

export function dbToVendingMachine(db: DbVendingMachine): VendingMachine {
  return {
    id: db.id,
    name: db.name,
    location: db.location,
    status: (db.status as VendingMachine['status']) ?? 'active',
    type: (db.machineType as VendingMachine['type']) ?? 'other',
    machineType: db.machineType ?? undefined,
    serialNumber: db.serialNumber ?? undefined,
    notes: db.notes ?? undefined,
    lastService: db.lastService?.toISOString?.(),
    nextService: db.nextService?.toISOString?.(),
    driverNotes: db.driverNotes ? JSON.parse(db.driverNotes) : undefined,
    created: db.createdAt?.toISOString?.(),
    updated: db.updatedAt?.toISOString?.(),
  }
}

export function vendingMachineToDb(vm: VendingMachineInput, ownerId: string) {
  return {
    name: vm.name!,
    location: vm.location!,
    status: vm.status ?? 'active',
    machineType: vm.type ?? vm.machineType ?? null,
    serialNumber: vm.serialNumber ?? null,
    notes: vm.notes ?? null,
    lastService: vm.lastService ? new Date(vm.lastService) : null,
    nextService: vm.nextService ? new Date(vm.nextService) : null,
    driverNotes: vm.driverNotes ? JSON.stringify(vm.driverNotes) : null,
    ownerId,
  }
}

export function dbToAnnouncement(db: DbAnnouncement): Announcement {
  return {
    id: db.id,
    message: db.message,
    priority: (db.priority as Announcement['priority']) ?? 'low',
    timestamp: db.createdAt?.toISOString?.(),
    type: (db.type as Announcement['type']) ?? 'general',
    category: db.category ?? undefined,
    expiresAt: db.expiresAt?.toISOString?.(),
    actionUrl: db.actionUrl ?? undefined,
    actionLabel: db.actionLabel ?? undefined,
  }
}

export function announcementToDb(a: AnnouncementInput, ownerId: string, userName?: string | null) {
  return {
    message: a.message!,
    priority: a.priority ?? 'low',
    type: a.type ?? 'general',
    category: a.category ?? null,
    expiresAt: a.expiresAt ? new Date(a.expiresAt) : null,
    actionUrl: a.actionUrl ?? null,
    actionLabel: a.actionLabel ?? null,
    author: userName ?? null,
    ownerId,
  }
}

export interface ActivityItem {
  id: string
  type: 'vehicle' | 'delivery' | 'client' | 'maintenance' | 'sop' | 'user'
  action: 'created' | 'updated' | 'deleted' | 'completed' | 'assigned' | 'status_changed'
  title: string
  description: string
  user: string
  userRole: string
  timestamp: string
  metadata?: Record<string, unknown>
}

// ─── JSON helpers ─────────────────────────────────────────────────────────────

const parseJson = <T>(s: string | null | undefined): T | undefined => {
  if (!s) return undefined
  try { return JSON.parse(s) as T } catch { return undefined }
}

const toJsonStr = (v: unknown): string | null =>
  v == null ? null : JSON.stringify(v)

const toDateStr = (d: Date | string | null | undefined): string | undefined =>
  d instanceof Date ? d.toISOString() : (d ?? undefined) as string | undefined

// ─── Vehicle converters ───────────────────────────────────────────────────────

export function dbToVehicle(v: DbVehicle): Vehicle {
  return {
    id: v.id,
    name: v.name,
    status: (v.status ?? 'inactive') as Vehicle['status'],
    driver: v.driver ?? '',
    assignedDriverId: v.assignedDriverId ?? null,
    location: v.location ?? '',
    eta: v.eta ?? '',
    mileage: v.mileage ?? 0,
    maintenanceDue: v.maintenanceDue ?? false,
    lastUpdated: toDateStr(v.lastUpdated),
    vehicleType: v.vehicleType ?? undefined,
    licensePlate: v.licensePlate ?? undefined,
    year: v.year ?? undefined,
    fuelLevel: v.fuelLevel ?? undefined,
    lastService: toDateOnly(v.lastService),
    nextService: toDateOnly(v.nextService),
  }
}

export function vehicleToDb(v: Omit<Vehicle, 'id'>, ownerId: string) {
  return {
    name: v.name,
    status: v.status,
    driver: v.driver || null,
    assignedDriverId: v.assignedDriverId ?? null,
    location: v.location || null,
    eta: v.eta || null,
    mileage: v.mileage ?? 0,
    maintenanceDue: v.maintenanceDue ?? false,
    vehicleType: v.vehicleType || null,
    licensePlate: v.licensePlate || null,
    year: v.year || null,
    fuelLevel: v.fuelLevel || null,
    lastService: v.lastService ? new Date(v.lastService) : null,
    nextService: v.nextService ? new Date(v.nextService) : null,
    ownerId,
    lastUpdated: new Date(),
  }
}

// ─── Delivery converters ──────────────────────────────────────────────────────

export function dbToDelivery(d: import('@prisma/client').Delivery): Delivery {
  return {
    id: d.id,
    address: d.address,
    customer: d.customer,
    status: d.status as Delivery['status'],
    driver: d.driver ?? '',
    assignedDriverId: d.assignedDriverId ?? null,
    items: d.items ?? 1,
    progress: d.progress ?? 0,
    notes: d.notes ?? undefined,
    scheduledTime: toDateStr(d.scheduledTime),
    estimatedArrival: toDateStr(d.estimatedArrival),
    completedTime: toDateStr(d.completedTime),
    parkingLocation: parseJson<LocationCoordinates>(d.parkingLocation),
    dropoffLocation: parseJson<LocationCoordinates>(d.dropoffLocation),
    parkingInstructions: d.parkingInstructions ?? undefined,
    dropoffInstructions: d.dropoffInstructions ?? undefined,
    contactPerson: parseJson<ContactPerson>(d.contactPerson),
    photos: parseJson<DeliveryPhoto[]>(d.photos),
    accessCodes: parseJson<string[]>(d.accessCodes),
    securityNotes: d.securityNotes ?? undefined,
    businessHours: d.businessHours ?? undefined,
    specialRequirements: parseJson<string[]>(d.specialRequirements),
  }
}

export function deliveryToDb(d: Omit<Delivery, 'id'>, ownerId: string) {
  return {
    address: d.address,
    customer: d.customer,
    status: d.status,
    driver: d.driver || null,
    assignedDriverId: d.assignedDriverId ?? null,
    items: d.items ?? 1,
    progress: d.progress ?? 0,
    notes: d.notes || null,
    scheduledTime: d.scheduledTime ? new Date(d.scheduledTime) : null,
    estimatedArrival: d.estimatedArrival ? new Date(d.estimatedArrival) : null,
    completedTime: d.completedTime ? new Date(d.completedTime) : null,
    parkingLocation: toJsonStr(d.parkingLocation),
    dropoffLocation: toJsonStr(d.dropoffLocation),
    parkingInstructions: d.parkingInstructions || null,
    dropoffInstructions: d.dropoffInstructions || null,
    contactPerson: toJsonStr(d.contactPerson),
    photos: toJsonStr(d.photos),
    accessCodes: toJsonStr(d.accessCodes),
    securityNotes: d.securityNotes || null,
    businessHours: d.businessHours || null,
    specialRequirements: toJsonStr(d.specialRequirements),
    ownerId,
  }
}

/** Preserve omitted fields when applying a partial delivery update. */
export function mergeDeliveryUpdate(existing: import('@prisma/client').Delivery, update: Partial<Delivery>): Delivery {
  return { ...dbToDelivery(existing), ...update }
}

// ─── MaintenanceTask converters ───────────────────────────────────────────────

export function dbToMaintenanceTask(t: DbMaintenanceTask & { vehicle?: { name: string } | null }): MaintenanceTask {
  return {
    id: t.id,
    vehicle: t.vehicleName ?? t.vehicle?.name ?? '',
    vehicleId: t.vehicleId ?? undefined,
    type: t.title ?? t.type ?? '',
    dueDate: toDateOnly(t.dueDate) ?? '',
    priority: (t.priority ?? 'medium') as MaintenanceTask['priority'],
    completed: t.completed ?? false,
    completedDate: toDateOnly(t.completedDate),
    notes: t.notes ?? undefined,
    estimatedDuration: t.estimatedDuration ?? undefined,
    partsNeeded: parseJson<string[]>(t.partsNeeded),
    serviceProvider: t.serviceProvider ?? undefined,
    costEstimate: t.costEstimate ?? undefined,
  }
}

export function maintenanceTaskToDb(t: Omit<MaintenanceTask, 'id'>, ownerId: string, vehicleId?: string) {
  return {
    title: t.type,
    type: t.type,
    vehicleName: t.vehicle || null,
    vehicleId: vehicleId || t.vehicleId || null,
    dueDate: parseDateOnly(t.dueDate) ?? new Date(NaN),
    priority: t.priority,
    completed: t.completed ?? false,
    completedDate: parseDateOnly(t.completedDate),
    notes: t.notes || null,
    estimatedDuration: t.estimatedDuration || null,
    partsNeeded: toJsonStr(t.partsNeeded),
    serviceProvider: t.serviceProvider || null,
    costEstimate: t.costEstimate || null,
    ownerId,
  }
}

/** Preserve required task fields when applying a partial maintenance update. */
export function mergeMaintenanceUpdate(existing: DbMaintenanceTask, update: Partial<MaintenanceTask>): MaintenanceTask {
  return { ...dbToMaintenanceTask(existing), ...update }
}

// ─── Client converters ────────────────────────────────────────────────────────

export function dbToClient(c: DbClient): Client {
  return {
    id: c.id,
    name: c.name,
    businessName: c.businessName ?? undefined,
    type: (c.type ?? 'other') as Client['type'],
    address: c.address,
    phone: c.phone ?? undefined,
    email: c.email ?? undefined,
    website: c.website ?? undefined,
    businessHours: c.businessHours ?? undefined,
    notes: c.notes ?? undefined,
    lastDeliveryDate: toDateOnly(c.lastDeliveryDate),
    deliveryFrequency: (c.deliveryFrequency as Client['deliveryFrequency']) ?? undefined,
    rating: c.rating ?? undefined,
    contactPerson: parseJson<ContactPerson>(c.contactPerson),
    preferredDeliveryTimes: parseJson<string[]>(c.preferredDeliveryTimes),
    accessCodes: parseJson<string[]>(c.accessCodes),
    specialRequirements: parseJson<string[]>(c.specialRequirements),
    primaryLocation: parseJson<LocationCoordinates>(c.primaryLocation),
    parkingLocation: parseJson<LocationCoordinates>(c.parkingLocation),
    dropoffLocation: parseJson<LocationCoordinates>(c.dropoffLocation),
    parkingInstructions: c.parkingInstructions ?? undefined,
    dropoffInstructions: c.dropoffInstructions ?? undefined,
    securityNotes: c.securityNotes ?? undefined,
    locationPhotos: parseJson<DeliveryPhoto[]>(c.locationPhotos),
    created: toDateStr(c.createdAt),
    updated: toDateStr(c.updatedAt),
  }
}

export function clientToDb(c: Omit<Client, 'id' | 'created' | 'updated'>, ownerId: string) {
  return {
    name: c.name,
    businessName: c.businessName || null,
    type: c.type || 'other',
    address: c.address,
    phone: c.phone || null,
    email: c.email || null,
    website: c.website || null,
    businessHours: c.businessHours || null,
    notes: c.notes || null,
    lastDeliveryDate: c.lastDeliveryDate ? new Date(c.lastDeliveryDate) : null,
    deliveryFrequency: c.deliveryFrequency || null,
    rating: c.rating || null,
    contactPerson: toJsonStr(c.contactPerson),
    preferredDeliveryTimes: toJsonStr(c.preferredDeliveryTimes),
    accessCodes: toJsonStr(c.accessCodes),
    specialRequirements: toJsonStr(c.specialRequirements),
    primaryLocation: toJsonStr(c.primaryLocation),
    parkingLocation: toJsonStr(c.parkingLocation),
    dropoffLocation: toJsonStr(c.dropoffLocation),
    parkingInstructions: c.parkingInstructions || null,
    dropoffInstructions: c.dropoffInstructions || null,
    securityNotes: c.securityNotes || null,
    locationPhotos: toJsonStr(c.locationPhotos),
    ownerId,
  }
}

// ─── Audit logging ────────────────────────────────────────────────────────────

export async function logActivity(
  prisma: Pick<PrismaClient, 'auditLog'>,
  opts: {
    userId: string
    teamId?: string | null
    userName?: string | null
    userRole?: string | null
    action: string
    entityType: string
    entityId?: string
    entityName?: string
    description: string
    metadata?: Record<string, unknown>
  }
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: opts.userId,
        teamId: opts.teamId || null,
        userName: opts.userName || null,
        userRole: opts.userRole || null,
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId || null,
        entityName: opts.entityName || null,
        description: opts.description,
        metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
      },
    })
  } catch (err) {
    // Never let audit log failure break the main operation
    console.error('AuditLog write failed:', err)
  }
}
