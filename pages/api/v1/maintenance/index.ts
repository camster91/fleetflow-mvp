import type { NextApiRequest, NextApiResponse } from 'next'
import { requireApiKey } from '../../../../lib/apiAuth'
import { prisma } from '../../../../lib/prisma'
import { cursorQuery, parseCursorPagination, requireGet, sendCursorPage, sendPublicApiFailure } from '../../../../lib/publicApi'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const endpoint = '/api/v1/maintenance'
  if (!requireGet(req, res)) return
  const context = await requireApiKey(req, res, 'read')
  if (!context) return
  const pagination = parseCursorPagination(req, res, endpoint, context.apiResourceWhere)
  if (!pagination) return

  try {
    const rows = await prisma.maintenanceTask.findMany({
      where: context.apiResourceWhere,
      ...cursorQuery(pagination),
      select: {
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
