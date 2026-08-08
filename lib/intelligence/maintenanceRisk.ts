export const MAINTENANCE_RISK_RUBRIC = {
  version: 'maintenance-risk-v1',
  description: 'Deterministic operational attention indicators; not a failure prediction.',
  bands: { low: [0, 24], watch: [25, 49], high: [50, 100] },
  thresholds: {
    overdueDays: [{ min: 1, points: 10 }, { min: 8, points: 20 }, { min: 31, points: 30 }],
    mileageSinceService: [{ min: 5_000, points: 6 }, { min: 10_000, points: 12 }],
    repeatedOpenCategory: [{ min: 2, points: 8 }, { min: 3, points: 12 }],
    recordedCostIncrease: [{ minPercent: 25, minAmount: 100, points: 10 }, { minPercent: 75, minAmount: 100, points: 15 }],
    vehicleAge: [{ min: 8, points: 5 }, { min: 12, points: 10 }],
    openMaintenanceFlag: 15,
  },
} as const

type RiskBand = 'low' | 'watch' | 'high'
type TaskInput = Record<string, unknown>
export interface MaintenanceRiskInput {
  vehicle: { id: unknown; name?: unknown; year?: unknown; mileage?: unknown; lastService?: unknown; maintenanceDue?: unknown }
  tasks: TaskInput[]
  serviceMileage?: unknown
  currency?: unknown
  costUnit?: 'major' | 'minor' | unknown
  sourceComplete?: boolean
}
export interface MaintenanceRiskFactor {
  code: string
  label: string
  points: number
  evidence: string
  sourceIds: string[]
  links: string[]
}
export interface MaintenanceRiskResult {
  vehicleId: string
  vehicleName: string
  score: number
  band: RiskBand
  wording: string
  factors: MaintenanceRiskFactor[]
  missingData: string[]
  completeness: { available: number; expected: number; percent: number }
  rubricVersion: string
  generatedAt: string
  sourceComplete: boolean
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/
const MAX_MILEAGE = 10_000_000
const MAX_COST = 100_000_000

function finiteNumber(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null
}
function exactDate(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value
  if (typeof value !== 'string' || !ISO_INSTANT.test(value)) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}
function taskId(task: TaskInput): string | null {
  return typeof task.id === 'string' && task.id.length > 0 && task.id.length <= 128 ? task.id : null
}
function taskLink(id: string) { return `/maintenance?record=${encodeURIComponent(id)}` }
function pointsAt(value: number, thresholds: ReadonlyArray<{ min: number; points: number }>) {
  return thresholds.reduce((points, threshold) => value >= threshold.min ? threshold.points : points, 0)
}
function pushMissing(items: string[], message: string) { if (!items.includes(message)) items.push(message) }

export function scoreMaintenanceRisk(input: MaintenanceRiskInput, options: { now: Date }): MaintenanceRiskResult {
  if (!Number.isFinite(options.now.getTime())) throw new Error('A valid injected clock is required')
  const now = options.now
  const vehicleId = typeof input.vehicle.id === 'string' && input.vehicle.id ? input.vehicle.id : 'unknown'
  const vehicleName = typeof input.vehicle.name === 'string' && input.vehicle.name.trim() ? input.vehicle.name.trim().slice(0, 160) : 'Unnamed vehicle'
  const missingData: string[] = []
  const factors: MaintenanceRiskFactor[] = []
  let available = 0
  const suppliedTasks = Array.isArray(input.tasks) ? input.tasks : []
  const sourceComplete = input.sourceComplete !== false && suppliedTasks.length <= 500
  if (!sourceComplete) pushMissing(missingData, 'Maintenance task evidence was truncated; this score may omit contributing records.')

  const validTasks = suppliedTasks.slice(0, 500)
  const open = validTasks.filter(task => task.completed === false)
  const datedOpen = open.map(task => ({ task, id: taskId(task), due: exactDate(task.dueDate) })).filter(row => row.id && row.due) as Array<{ task: TaskInput; id: string; due: Date }>
  if (open.length === 0 || datedOpen.length === open.length) available++
  else pushMissing(missingData, 'One or more open maintenance due dates are invalid or not exact ISO timestamps.')
  const overdue = datedOpen.filter(row => row.due.getTime() < now.getTime())
  if (overdue.length) {
    const maxDays = Math.max(...overdue.map(row => Math.floor((now.getTime() - row.due.getTime()) / 86_400_000)))
    const points = pointsAt(maxDays, MAINTENANCE_RISK_RUBRIC.thresholds.overdueDays)
    const ids = overdue.map(row => row.id).sort()
    if (points) factors.push({ code: 'overdue-maintenance', label: 'Overdue maintenance', points, evidence: `${overdue.length} open task${overdue.length === 1 ? '' : 's'}; oldest is ${maxDays} full day${maxDays === 1 ? '' : 's'} overdue.`, sourceIds: ids, links: ids.map(taskLink) })
  }

  const mileage = finiteNumber(input.vehicle.mileage, 0, MAX_MILEAGE)
  const serviceMileage = finiteNumber(input.serviceMileage, 0, MAX_MILEAGE)
  if (mileage === null) pushMissing(missingData, 'Valid current mileage is unavailable.')
  if (serviceMileage === null || (mileage !== null && serviceMileage > mileage)) pushMissing(missingData, 'Valid mileage at last service is unavailable.')
  if (mileage !== null && serviceMileage !== null && serviceMileage <= mileage) available++
  if (mileage !== null && serviceMileage !== null && serviceMileage <= mileage) {
    const delta = mileage - serviceMileage
    const points = pointsAt(delta, MAINTENANCE_RISK_RUBRIC.thresholds.mileageSinceService)
    if (points) factors.push({ code: 'mileage-since-service', label: 'Mileage since recorded service', points, evidence: `${delta.toLocaleString('en-CA')} recorded distance units since service.`, sourceIds: [vehicleId], links: [`/vehicles/${encodeURIComponent(vehicleId)}`] })
  }

  const categories = new Map<string, string[]>()
  for (const task of open) {
    const id = taskId(task)
    const category = typeof task.type === 'string' ? task.type.trim().toLocaleLowerCase('en-CA').slice(0, 100) : ''
    if (!id || !category) continue
    categories.set(category, [...(categories.get(category) ?? []), id])
  }
  if (open.length === 0 || [...categories.values()].reduce((n, ids) => n + ids.length, 0) === open.length) available++
  else pushMissing(missingData, 'One or more open tasks have no usable category.')
  const repeated = [...categories.entries()].filter(([, ids]) => ids.length >= 2).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0]
  if (repeated) {
    const ids = repeated[1].sort()
    factors.push({ code: 'repeated-category', label: 'Repeated open task category', points: pointsAt(ids.length, MAINTENANCE_RISK_RUBRIC.thresholds.repeatedOpenCategory), evidence: `${ids.length} open tasks share the “${repeated[0]}” category.`, sourceIds: ids, links: ids.map(taskLink) })
  }

  const currencyOk = typeof input.currency === 'string' && /^[A-Z]{3}$/.test(input.currency)
  const unitOk = input.costUnit === 'major'
  const completedRows = validTasks.filter(task => task.completed === true)
  const completedCosts = completedRows.map(task => ({ id: taskId(task), date: exactDate(task.completedDate), cost: finiteNumber(task.actualCost, 0, MAX_COST), completed: task.completed })).filter(row => row.id && row.date && row.cost !== null) as Array<{ id: string; date: Date; cost: number }>
  if (!unitOk) pushMissing(missingData, 'Recorded costs are not in supported major currency units.')
  if (!currencyOk) pushMissing(missingData, 'A comparable ISO currency code is unavailable for recorded costs.')
  if (completedCosts.length < 4) pushMissing(missingData, 'At least four valid completed maintenance cost observations are required.')
  const invalidCostRows = completedRows.length - completedCosts.length
  if (invalidCostRows > 0) pushMissing(missingData, `${invalidCostRows} completed maintenance cost observation${invalidCostRows === 1 ? '' : 's'} have missing or invalid cost/date values.`)
  if (unitOk && currencyOk && completedCosts.length >= 4) available++
  if (unitOk && currencyOk && completedCosts.length >= 4) {
    completedCosts.sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id))
    const half = Math.floor(completedCosts.length / 2)
    const previous = completedCosts.slice(0, half)
    const recent = completedCosts.slice(-half)
    const avg = (rows: typeof completedCosts) => rows.reduce((sum, row) => sum + row.cost, 0) / rows.length
    const priorAverage = avg(previous), recentAverage = avg(recent), increase = recentAverage - priorAverage
    const percent = priorAverage > 0 ? increase / priorAverage * 100 : 0
    const threshold = [...MAINTENANCE_RISK_RUBRIC.thresholds.recordedCostIncrease].reverse().find(item => percent >= item.minPercent && increase >= item.minAmount)
    if (threshold) {
      const ids = recent.map(row => row.id).sort()
      factors.push({ code: 'recorded-cost-trend', label: 'Recorded maintenance cost trend', points: threshold.points, evidence: `Recent recorded average is ${Math.round(percent)}% higher (${input.currency} ${Math.round(increase)} increase) than the earlier recorded average.`, sourceIds: ids, links: ids.map(taskLink) })
    }
  }

  const currentYear = now.getUTCFullYear()
  const year = finiteNumber(input.vehicle.year, 1886, currentYear)
  if (year === null || !Number.isInteger(year)) pushMissing(missingData, 'Vehicle year is unavailable or outside the supported range.')
  else {
    available++
    const age = currentYear - year
    const points = pointsAt(age, MAINTENANCE_RISK_RUBRIC.thresholds.vehicleAge)
    if (points) factors.push({ code: 'vehicle-age', label: 'Vehicle age', points, evidence: `${age} calendar years since model year ${year}.`, sourceIds: [vehicleId], links: [`/vehicles/${encodeURIComponent(vehicleId)}`] })
  }
  if (typeof input.vehicle.maintenanceDue === 'boolean') available++
  else pushMissing(missingData, 'Vehicle maintenance flag is unavailable.')
  if (input.vehicle.maintenanceDue === true && !factors.some(factor => factor.code === 'overdue-maintenance')) factors.push({ code: 'open-maintenance-flag', label: 'Open maintenance flag', points: MAINTENANCE_RISK_RUBRIC.thresholds.openMaintenanceFlag, evidence: 'The vehicle record has its maintenance-due flag set; no scored overdue-task factor already represents it.', sourceIds: [vehicleId], links: [`/vehicles/${encodeURIComponent(vehicleId)}`] })

  const lastService = exactDate(input.vehicle.lastService)
  if (!lastService) pushMissing(missingData, 'Last service date must be an exact ISO timestamp.')
  else if (lastService.getTime() > now.getTime()) pushMissing(missingData, 'Last service date is in the future.')
  else {
    available++
    if (now.getTime() - lastService.getTime() > 730 * 86_400_000) pushMissing(missingData, 'Last service record is more than two years old and may be stale.')
  }

  factors.sort((a, b) => b.points - a.points || a.code.localeCompare(b.code))
  const score = Math.min(100, factors.reduce((total, factor) => total + factor.points, 0))
  const band = maintenanceRiskBand(score)
  const expected = 7
  return {
    vehicleId, vehicleName, score, band,
    wording: `${band === 'high' ? 'High' : band === 'watch' ? 'Watch' : 'Low'} maintenance attention based on recorded operational indicators.`,
    factors, missingData: missingData.sort(),
    completeness: { available, expected, percent: Math.round(available / expected * 100) },
    rubricVersion: MAINTENANCE_RISK_RUBRIC.version,
    generatedAt: now.toISOString(),
    sourceComplete,
  }
}

export function maintenanceRiskBand(score: number): RiskBand {
  return score >= 50 ? 'high' : score >= 25 ? 'watch' : 'low'
}
