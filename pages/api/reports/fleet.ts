import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireTenantContext } from '../../../lib/apiAuth'
import { canViewReports } from '../../../lib/permissions'
import { rateLimitMiddleware } from '../../../lib/rateLimit'
import { REPORT_ROW_LIMIT } from '../../../lib/reporting'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { tenant, session } = context
  if (!canViewReports(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
  if (!(await rateLimitMiddleware(req, res, 'api', `reports:${session.user.id}`))) return

  try {
    const vehicles = await prisma.vehicle.findMany({
      where: tenant.resourceWhere,
      select: {
        id: true,
        name: true,
        status: true,
        maintenanceDue: true,
        mileage: true,
        lastService: true,
        nextService: true,
        vehicleType: true,
        driver: true,
      },
      take: REPORT_ROW_LIMIT,
    })

    // Status breakdown (pie chart)
    const statusCounts: Record<string, number> = {}
    for (const v of vehicles) {
      const status = v.maintenanceDue ? 'maintenance' : v.status
      statusCounts[status] = (statusCounts[status] || 0) + 1
    }
    const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({ status, count }))

    // Vehicles needing maintenance
    const vehiclesNeedingMaintenance = vehicles
      .filter((v) => v.maintenanceDue)
      .map((v) => ({
        id: v.id,
        name: v.name,
        vehicleType: v.vehicleType,
        mileage: v.mileage,
        lastService: v.lastService?.toISOString() || null,
        nextService: v.nextService?.toISOString() || null,
        driver: v.driver,
      }))

    res.setHeader('Cache-Control', 'private, no-store')
    return res.json({
      statusBreakdown,
      vehiclesNeedingMaintenance,
      totalVehicles: vehicles.length,
      truncated: vehicles.length === REPORT_ROW_LIMIT,
    })
  } catch (error) {
    console.error('Fleet report error:', error)
    return res.status(500).json({ error: 'Failed to generate fleet report' })
  }
}
