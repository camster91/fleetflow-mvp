import type { NextApiRequest, NextApiResponse } from 'next'
import { requireApiKey } from '../../../../lib/apiAuth'
import { prisma } from '../../../../lib/prisma'
import { DRIVER_MAINTENANCE_SELECT } from '../../../../lib/driverScope'
import { cursorQuery, parseCursorPagination, publicApiReadScope, requireGet, sendCursorPage, sendPublicApiFailure } from '../../../../lib/publicApi'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const endpoint = '/api/v1/maintenance'
  if (!requireGet(req, res)) return
  const context = await requireApiKey(req, res, 'read')
  if (!context) return
  const scope = publicApiReadScope(res, context, 'maintenance')
  if (!scope) return
  const pagination = parseCursorPagination(req, res, endpoint, context.apiResourceWhere)
  if (!pagination) return

  try {
    const rows = await prisma.maintenanceTask.findMany({
      where: scope.where,
      ...cursorQuery(pagination),
      select: scope.driverOnly ? DRIVER_MAINTENANCE_SELECT : {
        id: true, title: true, type: true, vehicleName: true, vehicleId: true,
        dueDate: true, priority: true, completed: true, completedDate: true,
        estimatedDuration: true, serviceProvider: true, costEstimate: true, actualCost: true,
      },
    })
    return sendCursorPage(res, rows, pagination.limit, endpoint, context.apiResourceWhere)
  } catch {
    return sendPublicApiFailure(res)
  }
}
