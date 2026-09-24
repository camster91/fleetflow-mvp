import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/auth', () => ({ getServerSession: jest.fn(), authOptions: {} }))
jest.mock('@/lib/rateLimit', () => ({ rateLimitMiddleware: jest.fn().mockResolvedValue(true) }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    team: { findMany: jest.fn() },
    vehicle: { findMany: jest.fn() },
    delivery: { findMany: jest.fn() },
    maintenanceTask: { findMany: jest.fn() },
  },
}))

import fleetHandler from '@/pages/api/reports/fleet'
import deliveriesHandler from '@/pages/api/reports/deliveries'
import maintenanceHandler from '@/pages/api/reports/maintenance'
import { getServerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const routes = [
  ['fleet', fleetHandler],
  ['deliveries', deliveriesHandler],
  ['maintenance', maintenanceHandler],
] as const

const call = async (handler: (req: never, res: never) => unknown, method = 'GET', query: Record<string, string> = {}) => {
  const { req, res } = createMocks({ method: method as 'GET', query })
  await handler(req as never, res as never)
  return res
}

describe('GET /api/reports/{fleet,deliveries,maintenance}', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.vehicle.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.delivery.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.maintenanceTask.findMany as jest.Mock).mockResolvedValue([])
  })

  it.each(routes)('%s rejects non-GET methods', async (_name, handler) => {
    const res = await call(handler, 'POST')
    expect(res._getStatusCode()).toBe(405)
    expect(res.getHeader('Allow')).toBe('GET')
  })

  it.each(routes)('%s returns 401 without a session', async (_name, handler) => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = await call(handler)
    expect(res._getStatusCode()).toBe(401)
    expect(prisma.vehicle.findMany).not.toHaveBeenCalled()
  })

  it.each(routes)('%s forbids roles without report access', async (_name, handler) => {
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([
      { id: 'team-1', ownerId: 'owner-2', members: [{ role: 'DRIVER' }] },
    ])
    const res = await call(handler)
    expect(res._getStatusCode()).toBe(403)
  })

  it('fleet scopes vehicles to the tenant and summarizes status', async () => {
    ;(prisma.vehicle.findMany as jest.Mock).mockResolvedValue([
      { id: 'v1', name: 'Van', status: 'active', maintenanceDue: false, mileage: 1, lastService: null, nextService: null, vehicleType: 'van', driver: null },
      { id: 'v2', name: 'Truck', status: 'active', maintenanceDue: true, mileage: 2, lastService: null, nextService: null, vehicleType: 'truck', driver: 'D' },
    ])
    const res = await call(fleetHandler)
    expect(res._getStatusCode()).toBe(200)
    expect(prisma.vehicle.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: 'owner-1', teamId: null } }))
    expect(res._getJSONData()).toMatchObject({ totalVehicles: 2, truncated: false, vehiclesNeedingMaintenance: [{ id: 'v2' }] })
    expect(res.getHeader('Cache-Control')).toBe('private, no-store')
  })

  it('deliveries scopes to the tenant workspace and date range', async () => {
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([
      { id: 'team-1', ownerId: 'owner-2', members: [{ role: 'MANAGER' }] },
    ])
    const res = await call(deliveriesHandler)
    expect(res._getStatusCode()).toBe(200)
    const where = (prisma.delivery.findMany as jest.Mock).mock.calls[0][0].where
    expect(where.AND[0]).toEqual({ teamId: 'team-1' })
    expect(where.AND[1].createdAt.gte).toBeInstanceOf(Date)
  })

  it.each([
    ['deliveries', deliveriesHandler],
    ['maintenance', maintenanceHandler],
  ] as const)('%s rejects an invalid date range', async (_name, handler) => {
    const res = await call(handler, 'GET', { startDate: 'not-a-date' })
    expect(res._getStatusCode()).toBe(400)
  })

  it('maintenance returns tenant-scoped cost breakdowns', async () => {
    ;(prisma.maintenanceTask.findMany as jest.Mock).mockResolvedValue([])
    const res = await call(maintenanceHandler)
    expect(res._getStatusCode()).toBe(200)
    expect((prisma.maintenanceTask.findMany as jest.Mock).mock.calls[0][0].where.AND[0]).toEqual({ ownerId: 'owner-1', teamId: null })
  })

  it('returns 500 without leaking internals when the query fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    ;(prisma.vehicle.findMany as jest.Mock).mockRejectedValue(new Error('db down: secret'))
    const res = await call(fleetHandler)
    expect(res._getStatusCode()).toBe(500)
    expect(JSON.stringify(res._getJSONData())).not.toContain('secret')
  })
})
