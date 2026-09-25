import type { NextApiRequest, NextApiResponse } from 'next'
import { requireApiKey } from '../../../../lib/apiAuth'
import { prisma } from '../../../../lib/prisma'
import { DRIVER_VEHICLE_SELECT } from '../../../../lib/driverScope'
import {
  cursorQuery,
  parseCursorPagination,
  publicApiReadScope,
  requireGet,
  sendCursorPage,
  sendPublicApiFailure,
} from '../../../../lib/publicApi'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const endpoint = '/api/v1/vehicles'
  if (!requireGet(req, res)) return
  const context = await requireApiKey(req, res, 'read')
  if (!context) return
  const scope = publicApiReadScope(res, context, 'vehicles')
  if (!scope) return
  const pagination = parseCursorPagination(req, res, endpoint, context.apiResourceWhere)
  if (!pagination) return

  try {
    const rows = await prisma.vehicle.findMany({
      where: scope.where,
      ...cursorQuery(pagination),
      select: scope.driverOnly
        ? DRIVER_VEHICLE_SELECT
        : {
            id: true,
            name: true,
            status: true,
            driver: true,
            location: true,
            eta: true,
            mileage: true,
            maintenanceDue: true,
            vehicleType: true,
            licensePlate: true,
            year: true,
            fuelLevel: true,
            lastService: true,
            nextService: true,
            lastUpdated: true,
          },
    })
    return sendCursorPage(res, rows, pagination.limit, endpoint, context.apiResourceWhere)
  } catch {
    return sendPublicApiFailure(res)
  }
}
