import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { requireTenantContext } from '../../../../lib/apiAuth'
import { canViewVehicles } from '../../../../lib/permissions'
import { driverVehicleDto, isDriverRole } from '../../../../lib/driverScope'

/** GET /api/vehicles/[id]/details
 * Returns vehicle + real maintenance tasks + driver user info if matched */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const context = await requireTenantContext(req, res)
  if (!context) return
  const { tenant, session } = context
  if (!canViewVehicles(tenant.role)) return res.status(403).json({ error: 'Forbidden' })

  const { id } = req.query
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Vehicle id required' })

  const vehicle = await prisma.vehicle.findFirst({
    where: {
      AND: [
        { id },
        tenant.resourceWhere,
        ...(isDriverRole(tenant.role) ? [{ assignedDriverId: session.user.id }] : []),
      ],
    },
  })
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' })

  // Fetch real maintenance tasks for this vehicle
  const maintenanceTasks = await prisma.maintenanceTask.findMany({
    where: { AND: [tenant.resourceWhere, { OR: [{ vehicleId: id }, { vehicleName: vehicle.name }] }] },
    orderBy: [{ completed: 'asc' }, { dueDate: 'asc' }],
    take: 10,
    select: {
      id: true,
      title: true,
      type: true,
      dueDate: true,
      priority: true,
      completed: true,
      completedDate: true,
      costEstimate: true,
      serviceProvider: true,
    },
  })

  // Try to look up driver as a team member or user by name
  let driverUser: { name: string | null; email: string; image: string | null } | null = null
  if (vehicle.driver && !isDriverRole(tenant.role)) {
    driverUser = await prisma.user
      .findFirst({
        where: {
          AND: [
            {
              OR: [
                { name: { equals: vehicle.driver } },
                { email: { contains: vehicle.driver.toLowerCase().replace(/\s+/g, '.') } },
              ],
            },
            tenant.teamId
              ? {
                  OR: [
                    { id: tenant.ownerId },
                    { teamMemberships: { some: { teamId: tenant.teamId, status: 'ACCEPTED' } } },
                  ],
                }
              : { id: tenant.ownerId },
          ],
        },
        select: { name: true, email: true, image: true },
      })
      .catch(() => null)
  }

  return res.json(
    isDriverRole(tenant.role)
      ? {
          vehicle: driverVehicleDto(vehicle),
          maintenanceTasks: maintenanceTasks.map((task) => ({
            id: task.id,
            title: task.title,
            type: task.type,
            dueDate: task.dueDate,
            priority: task.priority,
            completed: task.completed,
            completedDate: task.completedDate,
          })),
          driverUser: null,
        }
      : { vehicle, maintenanceTasks, driverUser }
  )
}
