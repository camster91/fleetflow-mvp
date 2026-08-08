import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/apiAuth', () => ({ requireTenantContext: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { vehicle: { findMany: jest.fn() }, client: { findMany: jest.fn() } } }))
import handler from '@/pages/api/assistant/entities'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const resourceWhere = { OR: [{ teamId: 'team-1' }, { ownerId: 'owner-1', teamId: null }] }
describe('/api/assistant/entities', () => {
  beforeEach(() => { jest.clearAllMocks(); (requireTenantContext as jest.Mock).mockResolvedValue({ session: { user: { id: 'u1' } }, tenant: { role: 'VIEWER', resourceWhere } }) })
  it('returns bounded authorized vehicle selector projections', async () => {
    ;(prisma.vehicle.findMany as jest.Mock).mockResolvedValue([{ id: 'v1', name: 'Van 1' }])
    const { req, res } = createMocks({ method: 'GET', query: { type: 'vehicle', q: 'van' } }); await handler(req as never, res as never)
    expect(prisma.vehicle.findMany).toHaveBeenCalledWith({ where: { AND: [resourceWhere, { name: { contains: 'van', mode: 'insensitive' } }] }, select: { id: true, name: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 20 })
    expect(res._getJSONData()).toEqual({ entities: [{ id: 'v1', label: 'Van 1' }] })
  })
  it('returns only client identity labels and no contact fields', async () => {
    ;(prisma.client.findMany as jest.Mock).mockResolvedValue([{ id: 'c1', name: 'Client 1', businessName: 'Business 1' }])
    const { req, res } = createMocks({ method: 'GET', query: { type: 'client' } }); await handler(req as never, res as never)
    expect(prisma.client.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: resourceWhere, select: { id: true, name: true, businessName: true }, take: 20 }))
    expect(res._getData()).not.toMatch(/email|phone|address/i)
  })
  it.each([{ method: 'POST', query: {} }, { method: 'GET', query: { type: 'driver' } }, { method: 'GET', query: { type: 'vehicle', q: 'x'.repeat(101) } }])('rejects unsupported selector requests %#', async init => {
    const { req, res } = createMocks(init as never); await handler(req as never, res as never); expect([400, 405]).toContain(res._getStatusCode())
  })
})
