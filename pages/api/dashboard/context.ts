import type { NextApiRequest, NextApiResponse } from 'next'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { dbToDelivery, dbToMaintenanceTask, dbToVehicle } from '@/lib/fleet'
import { resolveDashboardRole } from '@/lib/dashboardRoles'
import { DRIVER_DELIVERY_SELECT, DRIVER_MAINTENANCE_SELECT, DRIVER_VEHICLE_SELECT, driverDeliveryDto, driverMaintenanceDto, driverVehicleDto } from '@/lib/driverScope'

const TAKE = 10
const content = {
  admin: { decisions: ['Which fleet risks need intervention?', 'Where is capacity constrained?', 'Which team changes unblock work?'], actions: [['Review fleet risks','/intelligence'],['Add vehicle','/vehicles'],['Manage team','/team']] },
  dispatcher: { decisions: ['Which exceptions threaten today?', 'Which deliveries are unassigned?', 'Which routes need rebalancing?'], actions: [['Assign delivery','/deliveries'],['Review active deliveries','/deliveries'],['Check driver status','/vehicles']] },
  maintenance: { decisions: ['Which work is overdue?', 'Which vehicle is highest priority?', 'Which procedure applies?'], actions: [['Update work orders','/maintenance'],['Review maintenance schedule','/maintenance'],['Open service procedures','/sop']] },
  driver: { decisions: ['What is my next assigned stop?', 'Does my vehicle need attention?', 'Which safety procedure applies?'], actions: [['Open my deliveries','/deliveries'],['View my assigned vehicle','/vehicles'],['Open safety procedures','/sop']] },
  viewer: { decisions: ['What needs attention?', 'How much work is open?', 'Is dashboard coverage complete?'], actions: [] },
} as const

async function source<T>(rows: () => Promise<T[]>, total: () => Promise<number>) {
  try { const [items, count] = await Promise.all([rows(), total()]); return { available: true, error: null, items, total: count, truncated: count > items.length } }
  catch { return { available: false, error: 'SOURCE_UNAVAILABLE', items: [] as T[], total: null, truncated: false } }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') { res.setHeader('Allow','GET'); return res.status(405).json({ error: 'Method not allowed' }) }
  const context = await requireTenantContext(req,res); if (!context) return
  const dashboardRole = resolveDashboardRole(context.tenant.role)
  const driverScope = dashboardRole === 'driver' ? { assignedDriverId: context.session.user.id } : {}
  const vehicleWhere = { ...context.tenant.resourceWhere, ...driverScope }
  const deliveryWhere = { ...context.tenant.resourceWhere, ...driverScope }
  const maintenanceWhere = dashboardRole === 'driver'
    ? { ...context.tenant.resourceWhere, vehicle: { assignedDriverId: context.session.user.id } }
    : context.tenant.resourceWhere
  const driverDashboard = dashboardRole === 'driver'
  const [vehicles, deliveries, maintenance] = await Promise.all([
    source<unknown>(() => driverDashboard
      ? prisma.vehicle.findMany({ where: vehicleWhere, orderBy: { createdAt: 'asc' }, select: DRIVER_VEHICLE_SELECT, take: TAKE }).then(rows => rows.map(driverVehicleDto))
      : prisma.vehicle.findMany({ where: vehicleWhere, orderBy: { createdAt: 'asc' }, take: TAKE }).then(rows => rows.map(dbToVehicle)), () => prisma.vehicle.count({ where: vehicleWhere })),
    source<unknown>(() => driverDashboard
      ? prisma.delivery.findMany({ where: deliveryWhere, orderBy: { createdAt: 'desc' }, select: DRIVER_DELIVERY_SELECT, take: TAKE }).then(rows => rows.map(driverDeliveryDto))
      : prisma.delivery.findMany({ where: deliveryWhere, orderBy: { createdAt: 'desc' }, take: TAKE }).then(rows => rows.map(dbToDelivery)), () => prisma.delivery.count({ where: deliveryWhere })),
    source<unknown>(() => driverDashboard
      ? prisma.maintenanceTask.findMany({ where: maintenanceWhere, orderBy: { dueDate: 'asc' }, select: DRIVER_MAINTENANCE_SELECT, take: TAKE }).then(rows => rows.map(driverMaintenanceDto))
      : prisma.maintenanceTask.findMany({ where: maintenanceWhere, orderBy: { dueDate: 'asc' }, include: { vehicle: { select: { name: true } } }, take: TAKE }).then(rows => rows.map(dbToMaintenanceTask)), () => prisma.maintenanceTask.count({ where: maintenanceWhere })),
  ])
  const sources = { vehicles, deliveries, maintenance }
  if (Object.values(sources).every(item => !item.available)) return res.status(503).json({ error: 'Dashboard data unavailable' })
  return res.status(200).json({ role: context.tenant.role, dashboardRole, onboardingCompleted: context.session.user.onboardingCompleted === true, decisions: [...content[dashboardRole].decisions], actions: content[dashboardRole].actions.map(([label,href]) => ({ label,href })), sources })
}
