import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireTenantContext } from '../../../lib/apiAuth'
import { canViewReports } from '../../../lib/permissions'
import { rateLimitMiddleware } from '../../../lib/rateLimit'
import { parseReportDateRange, REPORT_ROW_LIMIT } from '../../../lib/reporting'

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

  const range = parseReportDateRange(req.query.startDate, req.query.endDate)
  if (!range.ok) return res.status(400).json({ error: range.error })
  const { startDate, endDate } = range

  try {
    const deliveries = await prisma.delivery.findMany({
      where: { AND: [tenant.resourceWhere, { createdAt: { gte: startDate, lte: endDate } }] },
      orderBy: { createdAt: 'asc' },
      take: REPORT_ROW_LIMIT,
    })

    const statusCounts: Record<string, number> = {}
    for (const delivery of deliveries) {
      statusCounts[delivery.status] = (statusCounts[delivery.status] || 0) + 1
    }
    const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({ status, count }))

    const completed = deliveries.filter((delivery) => delivery.status === 'delivered')
    const onTime = completed.filter((delivery) => {
      if (!delivery.scheduledTime || !delivery.completedTime) return true
      return new Date(delivery.completedTime) <= new Date(delivery.scheduledTime)
    })
    const onTimeRate = completed.length > 0 ? Math.round((onTime.length / completed.length) * 100) : 0

    const driverCounts: Record<string, number> = {}
    for (const delivery of deliveries) {
      if (delivery.driver) {
        driverCounts[delivery.driver] = (driverCounts[delivery.driver] || 0) + 1
      }
    }
    const topDrivers = Object.entries(driverCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([driver, count]) => ({ driver, deliveries: count }))

    let avgDeliveryTime = 0
    const withTimes = completed.filter((delivery) => delivery.createdAt && delivery.completedTime)
    if (withTimes.length > 0) {
      const totalHours = withTimes.reduce((sum, delivery) => {
        const hours = (new Date(delivery.completedTime!).getTime() - delivery.createdAt.getTime()) / 3_600_000
        return sum + hours
      }, 0)
      avgDeliveryTime = Math.round((totalHours / withTimes.length) * 10) / 10
    }

    res.setHeader('Cache-Control', 'private, no-store')
    return res.json({
      statusBreakdown,
      onTimeRate,
      topDrivers,
      avgDeliveryTime,
      totalDeliveries: deliveries.length,
      truncated: deliveries.length === REPORT_ROW_LIMIT,
    })
  } catch (error) {
    console.error('Delivery report error:', error)
    return res.status(500).json({ error: 'Failed to generate delivery report' })
  }
}
