import type { NextApiRequest, NextApiResponse } from 'next'
import { requireApiKey } from '../../../../lib/apiAuth'
import { prisma } from '../../../../lib/prisma'
import { DRIVER_DELIVERY_SELECT } from '../../../../lib/driverScope'
import {
  cursorQuery,
  parseCursorPagination,
  publicApiReadScope,
  requireGet,
  sendCursorPage,
  sendPublicApiFailure,
} from '../../../../lib/publicApi'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const endpoint = '/api/v1/deliveries'
  if (!requireGet(req, res)) return
  const context = await requireApiKey(req, res, 'read')
  if (!context) return
  const scope = publicApiReadScope(res, context, 'deliveries')
  if (!scope) return
  const pagination = parseCursorPagination(req, res, endpoint, context.apiResourceWhere)
  if (!pagination) return

  try {
    const rows = await prisma.delivery.findMany({
      where: scope.where,
      ...cursorQuery(pagination),
      select: scope.driverOnly
        ? DRIVER_DELIVERY_SELECT
        : {
            id: true,
            address: true,
            customer: true,
            status: true,
            driver: true,
            items: true,
            progress: true,
            scheduledTime: true,
            estimatedArrival: true,
            completedTime: true,
            vehicleId: true,
            createdAt: true,
            updatedAt: true,
          },
    })
    return sendCursorPage(res, rows, pagination.limit, endpoint, context.apiResourceWhere)
  } catch {
    return sendPublicApiFailure(res)
  }
}
