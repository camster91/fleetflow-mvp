import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireTenantContext } from '../../../lib/apiAuth'
import { canExportData } from '../../../lib/permissions'
import { rateLimitMiddleware } from '../../../lib/rateLimit'
import { parseReportDateRange, REPORT_ROW_LIMIT } from '../../../lib/reporting'

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const keys = Object.keys(rows[0])
  const escape = (value: unknown) => {
    const text = String(value ?? '')
    // Spreadsheet programs may evaluate quoted CSV cells as formulas.
    const literal = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text
    return '"' + literal.replace(/"/g, '""') + '"'
  }
  return [keys.map(escape).join(','), ...rows.map((r) => keys.map((k) => escape(r[k])).join(','))].join('\n')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { tenant, session } = context
  if (!canExportData(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
  if (!(await rateLimitMiddleware(req, res, 'api', `reports:${session.user.id}`))) return
  const type = req.query.type as string
  const range = parseReportDateRange(req.query.startDate, req.query.endDate)
  if (!range.ok) return res.status(400).json({ error: range.error })
  const { startDate, endDate } = range

  if (!['maintenance', 'deliveries', 'fleet'].includes(type)) {
    return res.status(400).json({ error: 'Invalid report type. Use: maintenance, deliveries, or fleet' })
  }

  try {
    let rows: Record<string, unknown>[] = []

    if (type === 'maintenance') {
      const tasks = await prisma.maintenanceTask.findMany({
        where: { AND: [tenant.resourceWhere, { createdAt: { gte: startDate, lte: endDate } }] },
        include: { vehicle: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
        take: REPORT_ROW_LIMIT,
      })
      rows = tasks.map((t) => ({
        Title: t.title,
        Type: t.type,
        Vehicle: t.vehicle?.name || t.vehicleName || '',
        'Due Date': t.dueDate.toISOString().slice(0, 10),
        Priority: t.priority,
        Completed: t.completed ? 'Yes' : 'No',
        'Completed Date': t.completedDate?.toISOString().slice(0, 10) || '',
        'Cost Estimate': t.costEstimate ?? '',
        'Service Provider': t.serviceProvider || '',
      }))
    } else if (type === 'deliveries') {
      const deliveries = await prisma.delivery.findMany({
        where: { AND: [tenant.resourceWhere, { createdAt: { gte: startDate, lte: endDate } }] },
        orderBy: { createdAt: 'asc' },
        take: REPORT_ROW_LIMIT,
      })
      rows = deliveries.map((d) => ({
        Customer: d.customer,
        Address: d.address,
        Status: d.status,
        Driver: d.driver || '',
        Items: d.items,
        'Scheduled Time': d.scheduledTime?.toISOString() || '',
        'Completed Time': d.completedTime?.toISOString() || '',
        'Created At': d.createdAt.toISOString().slice(0, 10),
      }))
    } else if (type === 'fleet') {
      const vehicles = await prisma.vehicle.findMany({
        where: tenant.resourceWhere,
        orderBy: { name: 'asc' },
        take: REPORT_ROW_LIMIT,
      })
      rows = vehicles.map((v) => ({
        Name: v.name,
        Status: v.status,
        Driver: v.driver || '',
        'Vehicle Type': v.vehicleType || '',
        'License Plate': v.licensePlate || '',
        Mileage: v.mileage ?? '',
        'Maintenance Due': v.maintenanceDue ? 'Yes' : 'No',
        'Last Service': v.lastService?.toISOString().slice(0, 10) || '',
        'Next Service': v.nextService?.toISOString().slice(0, 10) || '',
      }))
    }

    const csv = toCsv(rows)
    const filename = `${type}-report-${startDate.toISOString().slice(0, 10)}-to-${endDate.toISOString().slice(0, 10)}.csv`

    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.status(200).send(csv)
  } catch (error) {
    console.error('Export error:', error)
    return res.status(500).json({ error: 'Failed to export report' })
  }
}
