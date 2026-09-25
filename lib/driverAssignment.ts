type Tenant = { ownerId: string; teamId: string | null }
type Db = { user: { findFirst(args: unknown): Promise<{ id: string; name: string | null } | null> } }

export async function resolveDriverAssignment(db: Db, tenant: Tenant, value: unknown) {
  if (value === null || value === undefined || value === '') return { assignedDriverId: null, driver: null }
  if (typeof value !== 'string' || value.length > 64) throw new Error('INVALID_DRIVER_ASSIGNMENT')
  if (!tenant.teamId && value !== tenant.ownerId) throw new Error('INVALID_DRIVER_ASSIGNMENT')
  const where = tenant.teamId
    ? {
        id: value,
        OR: [
          { id: tenant.ownerId },
          { teamMemberships: { some: { teamId: tenant.teamId, status: 'ACCEPTED', role: 'DRIVER' } } },
        ],
      }
    : { id: value }
  const user = await db.user.findFirst({ where, select: { id: true, name: true } })
  if (!user) throw new Error('INVALID_DRIVER_ASSIGNMENT')
  return { assignedDriverId: user.id, driver: user.name }
}
