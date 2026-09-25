import { prisma } from '@/lib/prisma'
import type { FleetQueryPlan } from './queryPlanner'
import type { AssistantClaim, AssistantSource } from './answerCitations'

export interface FleetToolResult {
  claims: AssistantClaim[]
  sources: AssistantSource[]
}
type Scope = { resourceWhere: Record<string, unknown>; findingScope: { ownerId: string; teamId: string | null } }
type Db = typeof prisma
const LIMIT = 25
const source = (type: AssistantSource['type'], id: string, label: string, href: string): AssistantSource => ({
  id: `${type}:${id}`,
  type,
  recordId: id,
  label,
  href,
})
const claim = (text: string, ...citationIds: string[]): AssistantClaim => ({ text, citationIds })
const isoDay = (value: Date) => value.toISOString().slice(0, 10)

export async function runFleetTool(
  plan: Extract<FleetQueryPlan, { supported: true }>,
  scope: Scope,
  options: { db?: Db; now?: Date } = {}
): Promise<FleetToolResult> {
  const db = options.db ?? prisma
  const now = options.now ?? new Date()
  const soon = new Date(now.getTime() + 14 * 86400000)
  if (plan.intent === 'attention') {
    const rows = await db.intelligenceFinding.findMany({
      where: { ...scope.findingScope, status: 'OPEN', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      select: { id: true, title: true, severity: true, actionUrl: true },
      orderBy: [{ score: 'desc' }, { id: 'asc' }],
      take: LIMIT,
    })
    const sources = rows
      .filter((r) => Boolean(r.actionUrl))
      .map((r) => source('finding', r.id, `Finding ${r.id}`, r.actionUrl!))
    const sourceIds = new Set(sources.map((item) => item.id))
    return {
      sources,
      claims: rows
        .filter((r) => sourceIds.has(`finding:${r.id}`))
        .map((r) => claim(`${r.severity} priority: ${r.title}`.slice(0, 500), `finding:${r.id}`)),
    }
  }
  if (plan.intent === 'maintenance_due') {
    const rows = await db.maintenanceTask.findMany({
      where: { AND: [scope.resourceWhere, { completed: false, dueDate: { lte: soon } }] },
      select: { id: true, dueDate: true, vehicleId: true },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      take: LIMIT,
    })
    const sources = rows.map((r) =>
      source('maintenance', r.id, `Maintenance record ${r.id}`, `/maintenance?record=${encodeURIComponent(r.id)}`)
    )
    return {
      sources,
      claims: rows.map((r, i) =>
        claim(
          `Maintenance record ${r.id} is due ${isoDay(r.dueDate)}${r.vehicleId ? ` for vehicle ${r.vehicleId}` : ''}.`,
          sources[i].id
        )
      ),
    }
  }
  if (plan.intent === 'cost_drivers') {
    const aggregates = await db.maintenanceTask.groupBy({
      by: ['vehicleId'],
      where: { AND: [scope.resourceWhere, { actualCost: { not: null }, vehicleId: { not: null } }] },
      _sum: { actualCost: true },
      _count: { _all: true },
      orderBy: [{ _sum: { actualCost: 'desc' } }, { vehicleId: 'asc' }],
      take: 5,
    })
    const ranked = aggregates
      .filter((item) => item.vehicleId && typeof item._sum.actualCost === 'number')
      .map((item) => ({ vehicleId: item.vehicleId!, total: item._sum.actualCost!, count: item._count._all }))
      .sort((a, b) => b.total - a.total || a.vehicleId.localeCompare(b.vehicleId))
    const rows = ranked.length
      ? await db.maintenanceTask.findMany({
          where: {
            AND: [
              scope.resourceWhere,
              { vehicleId: { in: ranked.map((item) => item.vehicleId) }, actualCost: { not: null } },
            ],
          },
          select: { id: true, actualCost: true, vehicleId: true },
          orderBy: [{ actualCost: 'desc' }, { id: 'asc' }],
          take: 45,
        })
      : []
    const vehicles = ranked.length
      ? await db.vehicle.findMany({
          where: { AND: [scope.resourceWhere, { id: { in: ranked.map((item) => item.vehicleId) } }] },
          select: { id: true },
          orderBy: { id: 'asc' },
          take: 5,
        })
      : []
    const allowedVehicles = new Set(vehicles.map((item) => item.id))
    const sources: AssistantSource[] = []
    const claims = ranked
      .filter((item) => allowedVehicles.has(item.vehicleId))
      .map((item) => {
        const records = rows.filter((row) => row.vehicleId === item.vehicleId).slice(0, 8)
        sources.push(
          source(
            'maintenanceAggregate',
            item.vehicleId,
            `Authoritative maintenance total for vehicle ${item.vehicleId}`,
            `/assistant/sources/maintenance-cost?vehicle=${encodeURIComponent(item.vehicleId)}`
          )
        )
        sources.push(
          source(
            'vehicle',
            item.vehicleId,
            `Vehicle ${item.vehicleId}`,
            `/vehicles?record=${encodeURIComponent(item.vehicleId)}`
          )
        )
        for (const record of records)
          sources.push(
            source(
              'maintenance',
              record.id,
              `Maintenance record ${record.id}`,
              `/maintenance?record=${encodeURIComponent(record.id)}`
            )
          )
        return claim(
          `Vehicle ${item.vehicleId} has ${item.total.toFixed(2)} in recorded maintenance cost across ${item.count} maintenance records. Up to ${records.length} contributing records are linked.`,
          `maintenanceAggregate:${item.vehicleId}`,
          `vehicle:${item.vehicleId}`,
          ...records.map((record) => `maintenance:${record.id}`)
        )
      })
    return { sources, claims }
  }
  if (plan.intent === 'delivery_exceptions') {
    // Pending alone is normal: an exception must be overdue, unscheduled,
    // unassigned, or carry an explicit delayed/failed status.
    const rows = await db.delivery.findMany({
      where: {
        AND: [
          scope.resourceWhere,
          {
            status: { notIn: ['delivered', 'cancelled'] },
            OR: [
              { scheduledTime: { lt: now } },
              { scheduledTime: null },
              { vehicleId: null },
              { status: { in: ['delayed', 'failed'] } },
              { status: { in: ['in-transit'] }, progress: { lt: 100 }, completedTime: null },
            ],
          },
        ],
      },
      select: { id: true, status: true, scheduledTime: true, vehicleId: true, progress: true, completedTime: true },
      orderBy: [{ scheduledTime: 'asc' }, { id: 'asc' }],
      take: LIMIT,
    })
    const sources = rows.map((r) =>
      source('delivery', r.id, `Delivery ${r.id}`, `/deliveries?record=${encodeURIComponent(r.id)}`)
    )
    return {
      sources,
      claims: rows.map((r, i) => {
        const reasons = [
          r.scheduledTime && r.scheduledTime < now ? 'late' : null,
          !r.scheduledTime ? 'missing a schedule' : null,
          !r.vehicleId ? 'unassigned' : null,
          ['delayed', 'failed'].includes(r.status) ? `marked ${r.status}` : null,
          r.status === 'in-transit' && r.progress < 100 && !r.completedTime
            ? `incomplete at ${r.progress}% progress`
            : null,
        ].filter((value): value is string => Boolean(value))
        return claim(
          `Delivery ${r.id} is ${reasons.join(', ')}${r.scheduledTime ? `; scheduled ${isoDay(r.scheduledTime)}` : ''}.`,
          sources[i].id
        )
      }),
    }
  }
  if (plan.intent === 'vehicle_summary') {
    const row = await db.vehicle.findFirst({
      where: { AND: [scope.resourceWhere, { id: plan.entityId }] },
      select: { id: true, name: true, status: true, mileage: true, maintenanceDue: true, lastUpdated: true },
    })
    if (!row) return { claims: [], sources: [] }
    const item = source('vehicle', row.id, row.name.slice(0, 120), `/vehicles?record=${encodeURIComponent(row.id)}`)
    return {
      sources: [item],
      claims: [
        claim(
          `${row.name} is ${row.status}, has ${row.mileage ?? 'unknown'} recorded mileage, and maintenance is ${row.maintenanceDue ? 'due' : 'not flagged due'}.`,
          item.id
        ),
      ],
    }
  }
  if (plan.intent === 'client_summary') {
    const row = await db.client.findFirst({
      where: { AND: [scope.resourceWhere, { id: plan.entityId }] },
      select: { id: true, type: true, lastDeliveryDate: true, deliveryFrequency: true, rating: true },
    })
    if (!row) return { claims: [], sources: [] }
    const item = source('client', row.id, `Client ${row.id}`, `/clients/${encodeURIComponent(row.id)}`)
    return {
      sources: [item],
      claims: [
        claim(
          `Client ${row.id} is recorded as ${row.type}; delivery frequency is ${row.deliveryFrequency || 'not recorded'} and the last delivery date is ${row.lastDeliveryDate ? isoDay(row.lastDeliveryDate) : 'not recorded'}.`,
          item.id
        ),
      ],
    }
  }
  const range = { gte: plan.from!, lte: plan.to! }
  const [vehicles, deliveries, maintenance, clients] = await Promise.all([
    db.vehicle.findMany({
      where: { AND: [scope.resourceWhere, { updatedAt: range }] },
      select: { id: true, name: true, status: true },
      orderBy: { id: 'asc' },
      take: LIMIT,
    }),
    db.delivery.findMany({
      where: { AND: [scope.resourceWhere, { updatedAt: range }] },
      select: { id: true, status: true },
      orderBy: { id: 'asc' },
      take: LIMIT,
    }),
    db.maintenanceTask.findMany({
      where: { AND: [scope.resourceWhere, { updatedAt: range }] },
      select: { id: true, completed: true },
      orderBy: { id: 'asc' },
      take: LIMIT,
    }),
    db.client.findMany({
      where: { AND: [scope.resourceWhere, { updatedAt: range }] },
      select: { id: true, type: true },
      orderBy: { id: 'asc' },
      take: LIMIT,
    }),
  ])
  const sources: AssistantSource[] = [
    ...vehicles.map((r) =>
      source('vehicle', r.id, r.name.slice(0, 120), `/vehicles?record=${encodeURIComponent(r.id)}`)
    ),
    ...deliveries.map((r) =>
      source('delivery', r.id, `Delivery ${r.id}`, `/deliveries?record=${encodeURIComponent(r.id)}`)
    ),
    ...maintenance.map((r) =>
      source('maintenance', r.id, `Maintenance record ${r.id}`, `/maintenance?record=${encodeURIComponent(r.id)}`)
    ),
    ...clients.map((r) => source('client', r.id, `Client ${r.id}`, `/clients/${encodeURIComponent(r.id)}`)),
  ].slice(0, LIMIT)
  const cited = sources.slice(0, 10)
  return {
    sources,
    claims: cited.length
      ? [
          claim(
            `${cited.length} source records were updated in the selected date range${sources.length > cited.length ? '; additional matching records were omitted from this bounded cited answer' : ''}.`,
            ...cited.map((s) => s.id)
          ),
        ]
      : [],
  }
}
