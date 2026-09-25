export type DataQualityEntityType = 'vehicle' | 'delivery' | 'maintenance' | 'client'
export type DataQualitySeverity = 'high' | 'medium' | 'low'

export interface DataQualityIssue {
  id: string
  entityType: DataQualityEntityType
  entityId: string
  severity: DataQualitySeverity
  field: string
  message: string
  actionUrl: string
}

export interface DataQualityVehicle {
  id: string
  status: string
  mileage?: number | null
  driver: string | null
  lastService: Date | null
  nextService: Date | null
  createdAt: Date
  updatedAt: Date
  lastUpdated: Date
}

export interface DataQualityDelivery {
  id: string
  status: string
  vehicleId: string | null
  driver: string | null
  scheduledTime: Date | null
  estimatedArrival: Date | null
  contactPerson: string | null
  updatedAt: Date
}

export interface DataQualityMaintenance {
  id: string
  completed: boolean
  dueDate: Date
  vehicleId: string | null
  costEstimate: number | null
  actualCost: number | null
  updatedAt: Date
}

export interface DataQualityClient {
  id: string
  phone: string | null
  email: string | null
  contactPerson: string | null
  updatedAt: Date
}

export interface DataQualityRecords {
  vehicles: DataQualityVehicle[]
  deliveries: DataQualityDelivery[]
  maintenance: DataQualityMaintenance[]
  clients: DataQualityClient[]
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Product rules, deliberately expressed as constants so results remain
 * deterministic and explainable. These are freshness indicators, not
 * predictions: active vehicles are expected weekly, active trips daily,
 * pending work weekly, and open maintenance monthly. Delivery status routes
 * define picked-up as active/urgent and failed, delivered and cancelled as
 * terminal, so terminal records are deliberately excluded from active checks.
 */
export const DATA_QUALITY_THRESHOLDS = Object.freeze({
  activeVehicleStaleMs: 7 * DAY_MS,
  zeroMileageGraceMs: 7 * DAY_MS,
  inTransitDeliveryStaleMs: DAY_MS,
  pendingDeliveryStaleMs: 7 * DAY_MS,
  openMaintenanceStaleMs: 30 * DAY_MS,
})

const severityRank: Record<DataQualitySeverity, number> = { high: 0, medium: 1, low: 2 }

function hasText(value: string | null): boolean {
  return Boolean(value?.trim())
}

function hasContactPerson(value: string | null): boolean {
  if (!hasText(value)) return false
  try {
    const parsed: unknown = JSON.parse(value as string)
    return Boolean(
      parsed &&
      typeof parsed === 'object' &&
      Object.values(parsed as Record<string, unknown>).some(
        (field) => typeof field === 'string' && field.trim().length > 0
      )
    )
  } catch {
    // A malformed but nonblank legacy string may itself be the contact name.
    // Valid JSON must be an object with a nonblank string value; `{}` and JSON
    // strings (including an empty JSON string) are not usable contact records.
    return true
  }
}

function stale(date: Date, now: Date, thresholdMs: number): boolean {
  const timestamp = new Date(date).getTime()
  return Number.isFinite(timestamp) && now.getTime() - timestamp > thresholdMs
}

function recordUrl(entityType: DataQualityEntityType, entityId: string): string {
  const id = encodeURIComponent(entityId)
  if (entityType === 'client') return `/clients/${id}`
  const collection = entityType === 'vehicle' ? 'vehicles' : entityType === 'delivery' ? 'deliveries' : 'maintenance'
  return `/${collection}?record=${id}`
}

function issue(
  entityType: DataQualityEntityType,
  entityId: string,
  severity: DataQualitySeverity,
  field: string,
  message: string
): DataQualityIssue {
  return {
    id: `${entityType}:${entityId}:${field}`,
    entityType,
    entityId,
    severity,
    field,
    message,
    actionUrl: recordUrl(entityType, entityId),
  }
}

/** Assess already tenant-scoped records. This function performs no I/O or AI calls. */
export function assessDataQuality(records: DataQualityRecords, now = new Date()): DataQualityIssue[] {
  const issues: DataQualityIssue[] = []

  for (const vehicle of records.vehicles) {
    if (vehicle.status !== 'active') continue
    const mileageMissing = vehicle.mileage === null || vehicle.mileage === undefined
    const mileageInvalid = typeof vehicle.mileage === 'number' && vehicle.mileage < 0
    const zeroLikelyDefault =
      vehicle.mileage === 0 && stale(vehicle.createdAt, now, DATA_QUALITY_THRESHOLDS.zeroMileageGraceMs)
    if (mileageMissing || mileageInvalid || zeroLikelyDefault) {
      issues.push(issue('vehicle', vehicle.id, 'high', 'mileage', 'Active vehicle needs a positive mileage reading.'))
    }
    if (!hasText(vehicle.driver)) {
      issues.push(issue('vehicle', vehicle.id, 'medium', 'driver', 'Active vehicle needs an assigned driver.'))
    }
    if (!vehicle.lastService) {
      issues.push(issue('vehicle', vehicle.id, 'low', 'lastService', 'Add the vehicle’s last service date.'))
    }
    if (!vehicle.nextService) {
      issues.push(issue('vehicle', vehicle.id, 'medium', 'nextService', 'Schedule the vehicle’s next service date.'))
    }
    if (stale(vehicle.lastUpdated || vehicle.updatedAt, now, DATA_QUALITY_THRESHOLDS.activeVehicleStaleMs)) {
      issues.push(
        issue('vehicle', vehicle.id, 'medium', 'lastUpdated', 'Active vehicle data has not been updated in 7 days.')
      )
    }
  }

  for (const delivery of records.deliveries) {
    const active =
      delivery.status === 'pending' ||
      delivery.status === 'picked-up' ||
      delivery.status === 'in-transit' ||
      delivery.status === 'delayed'
    if (!active) continue
    const urgent = delivery.status === 'picked-up' || delivery.status === 'in-transit' || delivery.status === 'delayed'
    const assignmentSeverity: DataQualitySeverity = urgent ? 'high' : 'medium'
    if (!delivery.vehicleId) {
      issues.push(
        issue('delivery', delivery.id, assignmentSeverity, 'vehicleId', 'Active delivery needs an assigned vehicle.')
      )
    }
    if (!hasText(delivery.driver)) {
      issues.push(
        issue(
          'delivery',
          delivery.id,
          assignmentSeverity,
          'driver',
          `${urgent ? 'In-transit' : 'Pending'} delivery needs an assigned driver.`
        )
      )
    }
    if (!delivery.scheduledTime) {
      issues.push(
        issue('delivery', delivery.id, assignmentSeverity, 'scheduledTime', 'Active delivery needs a scheduled time.')
      )
    }
    if (urgent && !delivery.estimatedArrival) {
      issues.push(
        issue(
          'delivery',
          delivery.id,
          'high',
          'estimatedArrival',
          'In-transit delivery needs an estimated arrival time.'
        )
      )
    }
    if (!hasContactPerson(delivery.contactPerson)) {
      issues.push(
        issue('delivery', delivery.id, 'low', 'contactPerson', 'Add a contact person for this active delivery.')
      )
    }
    const threshold = urgent
      ? DATA_QUALITY_THRESHOLDS.inTransitDeliveryStaleMs
      : DATA_QUALITY_THRESHOLDS.pendingDeliveryStaleMs
    if (stale(delivery.updatedAt, now, threshold)) {
      issues.push(
        issue(
          'delivery',
          delivery.id,
          urgent ? 'high' : 'medium',
          'updatedAt',
          urgent
            ? 'Active delivery has not been updated in 24 hours.'
            : 'Pending delivery has not been updated in 7 days.'
        )
      )
    }
  }

  for (const task of records.maintenance) {
    if (!task.vehicleId) {
      issues.push(issue('maintenance', task.id, 'medium', 'vehicleId', 'Maintenance task needs a linked vehicle.'))
    }
    if (task.completed) {
      if (task.actualCost === null) {
        issues.push(
          issue('maintenance', task.id, 'medium', 'actualCost', 'Completed maintenance needs its actual cost recorded.')
        )
      }
      continue
    }
    if (task.costEstimate === null) {
      issues.push(
        issue('maintenance', task.id, 'low', 'costEstimate', 'Add an estimated cost for this maintenance task.')
      )
    }
    if (stale(task.updatedAt, now, DATA_QUALITY_THRESHOLDS.openMaintenanceStaleMs)) {
      issues.push(
        issue('maintenance', task.id, 'medium', 'updatedAt', 'Open maintenance task has not been updated in 30 days.')
      )
    }
  }

  for (const client of records.clients) {
    if (!hasText(client.phone) && !hasText(client.email) && !hasContactPerson(client.contactPerson)) {
      issues.push(
        issue('client', client.id, 'medium', 'contact', 'Client needs a phone number, email, or contact person.')
      )
    }
  }

  return issues.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.id.localeCompare(b.id))
}
