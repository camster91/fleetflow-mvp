import type {
  FindingEvidence,
  FindingSeverity,
  GenerateFindingsInput,
  IntelligenceDataQualityIssue,
  IntelligenceDelivery,
  IntelligenceMaintenance,
  IntelligenceVehicle,
  UnrankedFinding,
} from './types'
import { startOfTodayInZone, startOfUtcDay } from '../dateOnly'

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

export const FINDING_RULE_VERSION = 'fleet-ops-v1'

/** Public thresholds make every finding explainable and independently testable. */
export const INTELLIGENCE_THRESHOLDS = Object.freeze({
  maintenanceDueSoonMs: 14 * DAY_MS,
  maintenanceCostWindowMs: 90 * DAY_MS,
  maintenanceCostMinSamples: 3,
  maintenanceCostMinTotalCents: 100_000,
  maintenanceCostShare: 0.5,
  deliveryScheduleGraceMs: 15 * 60 * 1000,
  deliveryHighLoadCount: 5,
  activeVehicleStaleMs: 7 * DAY_MS,
  delayedVehicleStaleMs: DAY_MS,
  maintenanceVehicleStaleMs: 3 * DAY_MS,
})

const ACTIVE_DELIVERY_STATUSES = new Set(['pending', 'picked-up', 'in-transit', 'delayed'])
export const MAX_OPAQUE_ID_LENGTH = 128
export const MAX_FINDING_ID_LENGTH = 1024
const ALLOWED_DATA_QUALITY_FIELDS = new Set([
  'actualCost', 'contact', 'contactPerson', 'costEstimate', 'driver',
  'estimatedArrival', 'lastService', 'lastUpdated', 'mileage', 'nextService',
  'scheduledTime', 'updatedAt', 'vehicleId',
])

function validNow(now: Date): number {
  const value = now instanceof Date ? now.getTime() : Number.NaN
  if (!Number.isFinite(value)) throw new TypeError('now must be a valid Date')
  return value
}

const ISO_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/i

/** Accept only an unambiguous ISO instant; date-only and local-time strings are rejected. */
function timestamp(value: Date | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) {
    const parsed = value.getTime()
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value !== 'string') return null
  const match = value.match(ISO_INSTANT)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const offsetHour = match[8].toUpperCase() === 'Z' ? 0 : Number(match[10])
  const offsetMinute = match[8].toUpperCase() === 'Z' ? 0 : Number(match[11])
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (
    year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth ||
    hour > 23 || minute > 59 || second > 59 ||
    offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)
  ) return null
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function iso(value: number | null): string | null {
  return value === null ? null : new Date(value).toISOString()
}

function normalizeStatus(status: unknown): string {
  return typeof status === 'string' ? status.trim().toLowerCase() : ''
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

export function isValidOpaqueId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_OPAQUE_ID_LENGTH &&
    value.trim() === value && /^[\x21-\x7e]+$/.test(value)
}

function assertTenantKey(value: unknown): asserts value is string {
  if (!isValidOpaqueId(value)) {
    throw new TypeError(`tenantKey must be an opaque identifier of 1-${MAX_OPAQUE_ID_LENGTH} visible ASCII characters`)
  }
}

function segment(value: string): string {
  return encodeURIComponent(value)
}

function stableId(tenantKey: string, rule: string, entityType: string, entityId: string, suffix?: string): string {
  assertTenantKey(tenantKey)
  const id = [FINDING_RULE_VERSION, tenantKey, rule, entityType, entityId, suffix]
    .filter((value): value is string => value !== undefined)
    .map(segment)
    .join(':')
  if (id.length > MAX_FINDING_ID_LENGTH) throw new TypeError('generated finding ID exceeds the persistence limit')
  return id
}

function compareStableText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Return a sorted copy so individual rule output never depends on input order. */
export function sortRuleFindings(findings: readonly UnrankedFinding[]): UnrankedFinding[] {
  return [...findings].sort((a, b) => compareStableText(a.id, b.id))
}

function recordUrl(entityType: FindingEvidence['entityType'], entityId: string): string {
  const id = encodeURIComponent(entityId)
  const collection = entityType === 'delivery' ? 'deliveries'
    : entityType === 'maintenance' ? 'maintenance'
      : `${entityType}s`
  return entityType === 'client' ? `/clients/${id}` : `/${collection}?record=${id}`
}

function expires(nowMs: number, durationMs: number): Date {
  return new Date(nowMs + durationMs)
}

function directEvidence(
  entityType: FindingEvidence['entityType'], entityId: string, field: string,
  value: FindingEvidence['value'], observedAt: number | null,
): FindingEvidence {
  return { entityType, entityId, field, value, timestamp: iso(observedAt) }
}

function confidence(label: 'high' | 'medium', score: number) {
  return { label, score } as const
}

function severityRank(severity: FindingSeverity): number {
  return severity === 'high' ? 3 : severity === 'medium' ? 2 : 1
}

function isEntityType(value: unknown): value is IntelligenceDataQualityIssue['entityType'] {
  return value === 'vehicle' || value === 'delivery' || value === 'maintenance' || value === 'client'
}

function isSeverity(value: unknown): value is FindingSeverity {
  return value === 'high' || value === 'medium' || value === 'low'
}

function safeIssueField(field: unknown): string {
  return typeof field === 'string' && ALLOWED_DATA_QUALITY_FIELDS.has(field) ? field : 'record'
}

function cents(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  // Convert the number's canonical decimal representation once at the
  // boundary. Comparison and aggregation below then use integer cents. This
  // also gives explicit half-up rounding for values such as 1.005 instead of
  // relying on binary floating-point multiplication.
  const match = value.toString().match(/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i)
  if (!match) return null
  const fraction = match[2] ?? ''
  const exponent = Number(match[3] ?? 0)
  if (!Number.isSafeInteger(exponent)) return null
  let amount = BigInt(`${match[1]}${fraction}`)
  const scale = 2 + exponent - fraction.length
  if (scale >= 0) {
    if (scale > 20) return null
    amount *= BigInt(10) ** BigInt(scale)
  } else {
    if (scale < -20) return 0
    const divisor = BigInt(10) ** BigInt(-scale)
    const quotient = amount / divisor
    const remainder = amount % divisor
    amount = quotient + (remainder * BigInt(2) >= divisor ? BigInt(1) : BigInt(0))
  }
  return amount <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(amount) : null
}

export function maintenanceScheduleFindings(input: GenerateFindingsInput): UnrankedFinding[] {
  const nowMs = validNow(input.now)
  // With a workspace zone, compare calendar days: today's date-only value
  // (UTC midnight) against each due date's UTC day.
  const referenceMs = input.timeZone ? startOfTodayInZone(input.timeZone, input.now).getTime() : nowMs
  const findings: UnrankedFinding[] = []
  for (const task of input.records.maintenance ?? []) {
    if (!task || task.completed || !isValidOpaqueId(task.id)) continue
    const rawDueMs = timestamp(task.dueDate)
    if (rawDueMs === null) continue
    const dueMs = input.timeZone ? startOfUtcDay(new Date(rawDueMs)).getTime() : rawDueMs
    if (dueMs > referenceMs + INTELLIGENCE_THRESHOLDS.maintenanceDueSoonMs) continue
    const overdue = dueMs < referenceMs
    const ageMs = overdue ? referenceMs - dueMs : 0
    const severity: FindingSeverity = overdue ? 'high' : 'medium'
    findings.push({
      id: stableId(input.tenantKey, overdue ? 'maintenance-overdue' : 'maintenance-due-soon', 'maintenance', task.id),
      type: overdue ? 'maintenance-overdue' : 'maintenance-due-soon',
      ruleVersion: FINDING_RULE_VERSION,
      severity,
      confidence: confidence('high', 1),
      title: overdue ? 'Maintenance is overdue' : 'Maintenance is due soon',
      explanation: overdue
        ? `This open maintenance task passed its due date ${Math.ceil(ageMs / DAY_MS)} day(s) ago.`
        : `This open maintenance task is due within ${INTELLIGENCE_THRESHOLDS.maintenanceDueSoonMs / DAY_MS} days.`,
      evidence: [directEvidence('maintenance', task.id, 'dueDate', new Date(dueMs).toISOString(), timestamp(task.updatedAt) ?? dueMs)],
      recommendedAction: overdue ? 'Review and reschedule or complete this maintenance task.' : 'Confirm the service appointment and required parts.',
      actionUrl: recordUrl('maintenance', task.id),
      generatedAt: new Date(nowMs),
      expiresAt: expires(nowMs, DAY_MS),
      urgency: overdue ? Math.min(100, 70 + Math.floor(ageMs / DAY_MS)) : 55,
    })
  }
  return sortRuleFindings(findings)
}

export function maintenanceCostFindings(input: GenerateFindingsInput): UnrankedFinding[] {
  const nowMs = validNow(input.now)
  const windowStart = nowMs - INTELLIGENCE_THRESHOLDS.maintenanceCostWindowMs
  const eligible: Array<{ task: IntelligenceMaintenance; cents: number; completedAt: number }> = []
  for (const task of input.records.maintenance ?? []) {
    if (!task || !task.completed || !isValidOpaqueId(task.id) || !isValidOpaqueId(task.vehicleId)) continue
    const amount = cents(task.actualCost)
    const completedAt = timestamp(task.completedDate)
    if (amount === null || completedAt === null || completedAt < windowStart || completedAt > nowMs) continue
    eligible.push({ task, cents: amount, completedAt })
  }
  const fleetTotal = eligible.reduce((total, item) => total + item.cents, 0)
  if (!Number.isSafeInteger(fleetTotal) || fleetTotal <= 0) return []

  const byVehicle = new Map<string, typeof eligible>()
  for (const item of eligible) {
    const vehicleId = item.task.vehicleId as string
    const values = byVehicle.get(vehicleId) ?? []
    values.push(item)
    byVehicle.set(vehicleId, values)
  }

  const findings: UnrankedFinding[] = []
  for (const [vehicleId, items] of byVehicle) {
    const total = items.reduce((sum, item) => sum + item.cents, 0)
    const share = total / fleetTotal
    if (
      items.length < INTELLIGENCE_THRESHOLDS.maintenanceCostMinSamples ||
      total < INTELLIGENCE_THRESHOLDS.maintenanceCostMinTotalCents ||
      share < INTELLIGENCE_THRESHOLDS.maintenanceCostShare
    ) continue
    const ordered = [...items].sort((a, b) => compareStableText(a.task.id, b.task.id))
    findings.push({
      id: stableId(input.tenantKey, 'maintenance-cost-concentration', 'vehicle', vehicleId),
      type: 'maintenance-cost-concentration',
      ruleVersion: FINDING_RULE_VERSION,
      severity: share >= 0.75 ? 'high' : 'medium',
      confidence: confidence('high', 0.95),
      title: 'Repeated maintenance costs are concentrated on one vehicle',
      explanation: `${items.length} completed tasks for this vehicle account for ${Math.round(share * 100)}% of recorded maintenance costs in the last 90 days.`,
      evidence: ordered.map(({ task, cents: amount, completedAt }) =>
        directEvidence('maintenance', task.id, 'actualCostCents', amount, completedAt)),
      recommendedAction: 'Review the vehicle cost history and decide whether repair, replacement, or monitoring is appropriate.',
      actionUrl: recordUrl('vehicle', vehicleId),
      generatedAt: new Date(nowMs),
      expiresAt: expires(nowMs, 7 * DAY_MS),
      urgency: Math.min(90, 40 + Math.round(share * 50)),
    })
  }
  return sortRuleFindings(findings)
}

export function staleVehicleFindings(input: GenerateFindingsInput): UnrankedFinding[] {
  const nowMs = validNow(input.now)
  const findings: UnrankedFinding[] = []
  for (const vehicle of input.records.vehicles ?? []) {
    if (!vehicle || !isValidOpaqueId(vehicle.id)) continue
    const status = normalizeStatus(vehicle.status)
    const threshold = status === 'active'
      ? INTELLIGENCE_THRESHOLDS.activeVehicleStaleMs
      : status === 'delayed'
        ? INTELLIGENCE_THRESHOLDS.delayedVehicleStaleMs
        : status === 'maintenance'
          ? INTELLIGENCE_THRESHOLDS.maintenanceVehicleStaleMs
          : null
    if (threshold === null) continue
    const observedAt = timestamp(vehicle.lastUpdated) ?? timestamp(vehicle.updatedAt)
    if (observedAt === null || nowMs - observedAt <= threshold) continue
    const days = Math.floor((nowMs - observedAt) / DAY_MS)
    findings.push({
      id: stableId(input.tenantKey, 'vehicle-stale', 'vehicle', vehicle.id),
      type: 'vehicle-stale', ruleVersion: FINDING_RULE_VERSION,
      severity: status === 'delayed' ? 'high' : 'medium',
      confidence: confidence('high', 1),
      title: 'Vehicle status needs an update',
      explanation: `This ${status} vehicle has not been updated for ${days} day(s); the ${threshold / DAY_MS}-day freshness threshold has passed.`,
      evidence: [directEvidence('vehicle', vehicle.id, 'lastUpdated', new Date(observedAt).toISOString(), observedAt)],
      recommendedAction: 'Confirm the vehicle status, location, and current assignment.',
      actionUrl: recordUrl('vehicle', vehicle.id),
      generatedAt: new Date(nowMs), expiresAt: expires(nowMs, DAY_MS),
      urgency: Math.min(100, 45 + Math.floor((nowMs - observedAt) / threshold) * 10),
    })
  }
  return sortRuleFindings(findings)
}

function activeDelivery(delivery: IntelligenceDelivery): boolean {
  return ACTIVE_DELIVERY_STATUSES.has(normalizeStatus(delivery.status))
}

export function deliveryScheduleFindings(input: GenerateFindingsInput): UnrankedFinding[] {
  const nowMs = validNow(input.now)
  const findings: UnrankedFinding[] = []
  for (const delivery of input.records.deliveries ?? []) {
    if (!delivery || !isValidOpaqueId(delivery.id) || !activeDelivery(delivery)) continue
    const scheduledAt = timestamp(delivery.scheduledTime)
    if (scheduledAt === null) continue
    const lateBy = nowMs - scheduledAt - INTELLIGENCE_THRESHOLDS.deliveryScheduleGraceMs
    if (lateBy <= 0) continue
    findings.push({
      id: stableId(input.tenantKey, 'delivery-schedule-passed', 'delivery', delivery.id),
      type: 'delivery-schedule-passed', ruleVersion: FINDING_RULE_VERSION,
      severity: lateBy >= HOUR_MS ? 'high' : 'medium',
      confidence: confidence('high', 1),
      title: 'Active delivery is past its scheduled time',
      explanation: `The scheduled time plus a ${INTELLIGENCE_THRESHOLDS.deliveryScheduleGraceMs / 60000}-minute grace period has passed.`,
      evidence: [directEvidence('delivery', delivery.id, 'scheduledTime', new Date(scheduledAt).toISOString(), timestamp(delivery.updatedAt) ?? scheduledAt)],
      recommendedAction: 'Check the delivery status and update the customer or assignment if needed.',
      actionUrl: recordUrl('delivery', delivery.id),
      generatedAt: new Date(nowMs), expiresAt: expires(nowMs, 4 * HOUR_MS),
      urgency: Math.min(100, 60 + Math.floor(lateBy / HOUR_MS) * 5),
    })
  }
  return sortRuleFindings(findings)
}

export function deliveryLoadFindings(input: GenerateFindingsInput): UnrankedFinding[] {
  const nowMs = validNow(input.now)
  const byVehicle = new Map<string, IntelligenceDelivery[]>()
  for (const delivery of input.records.deliveries ?? []) {
    if (!delivery || !isValidOpaqueId(delivery.id) || !activeDelivery(delivery) || !isValidOpaqueId(delivery.vehicleId)) continue
    const values = byVehicle.get(delivery.vehicleId as string) ?? []
    values.push(delivery)
    byVehicle.set(delivery.vehicleId as string, values)
  }
  const findings: UnrankedFinding[] = []
  for (const [vehicleId, deliveries] of byVehicle) {
    if (deliveries.length < INTELLIGENCE_THRESHOLDS.deliveryHighLoadCount) continue
    const ordered = [...deliveries].sort((a, b) => compareStableText(a.id, b.id))
    findings.push({
      id: stableId(input.tenantKey, 'vehicle-delivery-load', 'vehicle', vehicleId),
      type: 'vehicle-delivery-load', ruleVersion: FINDING_RULE_VERSION,
      severity: deliveries.length >= INTELLIGENCE_THRESHOLDS.deliveryHighLoadCount * 2 ? 'high' : 'medium',
      confidence: confidence('high', 1),
      title: 'Vehicle has a high active-delivery load',
      explanation: `This vehicle has ${deliveries.length} active deliveries; the review threshold is ${INTELLIGENCE_THRESHOLDS.deliveryHighLoadCount}.`,
      evidence: ordered.map(delivery => directEvidence('delivery', delivery.id, 'vehicleId', vehicleId, timestamp(delivery.updatedAt))),
      recommendedAction: 'Review route capacity and rebalance assignments if needed.',
      actionUrl: recordUrl('vehicle', vehicleId),
      generatedAt: new Date(nowMs), expiresAt: expires(nowMs, 4 * HOUR_MS),
      urgency: Math.min(100, 45 + deliveries.length * 5),
    })
  }
  return sortRuleFindings(findings)
}

export function unassignedDeliveryFindings(input: GenerateFindingsInput): UnrankedFinding[] {
  const nowMs = validNow(input.now)
  const findings: UnrankedFinding[] = []
  for (const delivery of input.records.deliveries ?? []) {
    if (!delivery || !isValidOpaqueId(delivery.id) || !activeDelivery(delivery)) continue
    const missingVehicle = !isValidOpaqueId(delivery.vehicleId)
    const missingDriver = !hasText(delivery.driver)
    if (!missingVehicle && !missingDriver) continue
    const fields = [missingVehicle ? 'vehicle' : null, missingDriver ? 'driver' : null].filter(Boolean).join(' and ')
    const evidence: FindingEvidence[] = []
    if (missingVehicle) evidence.push(directEvidence('delivery', delivery.id, 'vehicleId', null, timestamp(delivery.updatedAt)))
    if (missingDriver) evidence.push(directEvidence('delivery', delivery.id, 'driver', null, timestamp(delivery.updatedAt)))
    findings.push({
      id: stableId(input.tenantKey, 'delivery-unassigned', 'delivery', delivery.id),
      type: 'delivery-unassigned', ruleVersion: FINDING_RULE_VERSION,
      severity: normalizeStatus(delivery.status) === 'pending' ? 'medium' : 'high',
      confidence: confidence('high', 1),
      title: 'Active delivery is not fully assigned',
      explanation: `This active delivery has no assigned ${fields}.`, evidence,
      recommendedAction: 'Assign the missing driver or vehicle before continuing the delivery.',
      actionUrl: recordUrl('delivery', delivery.id),
      generatedAt: new Date(nowMs), expiresAt: expires(nowMs, 4 * HOUR_MS),
      urgency: normalizeStatus(delivery.status) === 'pending' ? 65 : 90,
    })
  }
  return sortRuleFindings(findings)
}

export function dataQualityBlockerFindings(input: GenerateFindingsInput): UnrankedFinding[] {
  const nowMs = validNow(input.now)
  const unique = new Map<string, IntelligenceDataQualityIssue>()
  for (const issue of input.records.dataQualityIssues ?? []) {
    if (!issue || !isValidOpaqueId(issue.entityId) || !isEntityType(issue.entityType) || !isSeverity(issue.severity)) continue
    const field = safeIssueField(issue.field)
    const key = stableId(input.tenantKey, 'data-quality-blocker', issue.entityType, issue.entityId, field)
    const current = unique.get(key)
    if (!current || severityRank(issue.severity) > severityRank(current.severity)) {
      unique.set(key, { ...issue, field })
    }
  }
  return sortRuleFindings([...unique.values()].map(issue => ({
    id: stableId(input.tenantKey, 'data-quality-blocker', issue.entityType, issue.entityId, issue.field),
    type: 'data-quality-blocker' as const, ruleVersion: FINDING_RULE_VERSION,
    severity: issue.severity,
    confidence: confidence('medium', 0.85),
    title: 'Record quality blocks reliable analysis',
    explanation: `This ${issue.entityType} record has missing or unreliable ${issue.field} data.`,
    evidence: [directEvidence(issue.entityType, issue.entityId, issue.field, null, null)],
    recommendedAction: 'Update the source record so future analysis can use complete information.',
    // Derive the link instead of trusting caller-provided URLs.
    actionUrl: recordUrl(issue.entityType, issue.entityId),
    generatedAt: new Date(nowMs), expiresAt: expires(nowMs, 7 * DAY_MS),
    urgency: issue.severity === 'high' ? 75 : issue.severity === 'medium' ? 50 : 25,
  })))
}

export const FINDING_RULES = Object.freeze([
  maintenanceScheduleFindings,
  maintenanceCostFindings,
  staleVehicleFindings,
  deliveryScheduleFindings,
  deliveryLoadFindings,
  unassignedDeliveryFindings,
  dataQualityBlockerFindings,
])
