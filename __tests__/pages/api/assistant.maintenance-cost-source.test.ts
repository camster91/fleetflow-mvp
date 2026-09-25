import { createMocks } from 'node-mocks-http'
jest.mock('@/lib/apiAuth', () => ({ requireTenantContext: jest.fn() }))
jest.mock('@/lib/rateLimit', () => ({ rateLimitMiddleware: jest.fn(() => Promise.resolve(true)) }))
jest.mock('@/lib/prisma', () => ({
  prisma: { maintenanceTask: { aggregate: jest.fn(), findMany: jest.fn() }, vehicle: { findFirst: jest.fn() } },
}))
import handler from '@/pages/api/assistant/sources/maintenance-cost'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { rateLimitMiddleware } from '@/lib/rateLimit'

const resourceWhere = { OR: [{ teamId: 't1' }, { ownerId: 'o1', teamId: null }] }
describe('maintenance cost citation source', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(requireTenantContext as jest.Mock).mockResolvedValue({
      session: { user: { id: 'u1' } },
      tenant: { role: 'VIEWER', resourceWhere },
    })
    ;(prisma.vehicle.findFirst as jest.Mock).mockResolvedValue({ id: 'v1' })
    ;(prisma.maintenanceTask.aggregate as jest.Mock).mockResolvedValue({
      _sum: { actualCost: 500 },
      _count: { _all: 12 },
    })
    ;(prisma.maintenanceTask.findMany as jest.Mock).mockResolvedValue([{ id: 'm1', actualCost: 100 }])
  })
  it('shows an authoritative scoped total/count with bounded canonical contributing links', async () => {
    const { req, res } = createMocks({ method: 'GET', query: { vehicle: 'v1' } })
    await handler(req as never, res as never)
    expect(prisma.maintenanceTask.aggregate).toHaveBeenCalledWith({
      where: { AND: [resourceWhere, { vehicleId: 'v1', actualCost: { not: null } }] },
      _sum: { actualCost: true },
      _count: { _all: true },
    })
    expect(res._getJSONData()).toEqual({
      vehicleId: 'v1',
      total: 500,
      count: 12,
      contributors: [{ id: 'm1', actualCost: 100, href: '/maintenance?record=m1' }],
      contributorsTruncated: true,
    })
  })
  it('fails closed for malformed or inaccessible vehicles', async () => {
    let mocks = createMocks({ method: 'GET', query: { vehicle: '../other' } })
    await handler(mocks.req as never, mocks.res as never)
    expect(mocks.res._getStatusCode()).toBe(400)
    ;(prisma.vehicle.findFirst as jest.Mock).mockResolvedValue(null)
    mocks = createMocks({ method: 'GET', query: { vehicle: 'other' } })
    await handler(mocks.req as never, mocks.res as never)
    expect(mocks.res._getStatusCode()).toBe(404)
    expect(prisma.maintenanceTask.aggregate).not.toHaveBeenCalled()
  })
  it('enforces a per-user rate limit before Prisma work', async () => {
    ;(rateLimitMiddleware as jest.Mock).mockResolvedValueOnce(false)
    const { req, res } = createMocks({ method: 'GET', query: { vehicle: 'v1' } })
    await handler(req as never, res as never)
    expect(rateLimitMiddleware).toHaveBeenCalledWith(req, res, 'api', 'assistant-cost-source:u1')
    expect(prisma.vehicle.findFirst).not.toHaveBeenCalled()
  })
})
