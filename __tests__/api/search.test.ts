import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/apiAuth', () => ({ requireTenantContext: jest.fn() }))
jest.mock('@/lib/rateLimit', () => ({ rateLimitMiddleware: jest.fn().mockResolvedValue(true) }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    vehicle: { findMany: jest.fn() },
    delivery: { findMany: jest.fn() },
    client: { findMany: jest.fn() },
    maintenanceTask: { findMany: jest.fn() },
  },
}))

import handler from '@/pages/api/search'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const db = prisma as unknown as Record<string, { findMany: jest.Mock }>
const resourceWhere = { teamId: 'team-1' }
function asRole(role: string) {
  ;(requireTenantContext as jest.Mock).mockResolvedValue({
    session: { user: { id: 'u1' } },
    tenant: { role, resourceWhere },
  })
}
async function call(method = 'GET', query: Record<string, string> = {}) {
  const { req, res } = createMocks({ method: method as never, query })
  await handler(req as never, res as never)
  return res
}

describe('GET /api/search', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    asRole('MANAGER')
    for (const model of Object.values(db)) model.findMany.mockResolvedValue([])
  })

  it('rejects other methods', async () => {
    expect((await call('DELETE'))._getStatusCode()).toBe(405)
  })

  it('forbids roles that cannot view business data', async () => {
    asRole('DRIVER')
    expect((await call('GET', { q: 'truck' }))._getStatusCode()).toBe(403)
    expect(db.vehicle.findMany).not.toHaveBeenCalled()
  })

  it('returns empty results for an empty query without touching the database', async () => {
    const res = await call('GET', { q: '' })
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData()).toEqual({ vehicles: [], deliveries: [], clients: [], maintenance: [] })
    expect(db.vehicle.findMany).not.toHaveBeenCalled()
  })

  it('rejects an oversized query', async () => {
    expect((await call('GET', { q: 'x'.repeat(500) }))._getStatusCode()).toBe(400)
  })

  it('scopes every search to the workspace and caps each group at 5', async () => {
    db.vehicle.findMany.mockResolvedValue([{ id: 'v1', name: 'Truck 1' }])
    const res = await call('GET', { q: 'truck' })
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData().vehicles).toEqual([{ id: 'v1', name: 'Truck 1' }])
    for (const model of Object.values(db)) {
      const args = model.findMany.mock.calls[0][0]
      expect(args.where.AND[0]).toBe(resourceWhere)
      expect(args.take).toBe(5)
    }
  })

  it('hides database errors', async () => {
    db.client.findMany.mockRejectedValue(new Error('boom'))
    const res = await call('GET', { q: 'acme' })
    expect(res._getStatusCode()).toBe(500)
    expect(res._getJSONData()).toEqual({ error: 'Search failed' })
  })
})
