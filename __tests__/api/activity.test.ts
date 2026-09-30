import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/apiAuth', () => ({ requireTenantContext: jest.fn() }))
jest.mock('@/lib/rateLimit', () => ({ rateLimitMiddleware: jest.fn().mockResolvedValue(true) }))
jest.mock('@/lib/prisma', () => ({ prisma: { auditLog: { findMany: jest.fn() } } }))

import handler from '@/pages/api/activity'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const auditWhere = { teamId: 'team-1' }
function asRole(role: string) {
  ;(requireTenantContext as jest.Mock).mockResolvedValue({
    session: { user: { id: 'u1' } },
    tenant: { role, auditWhere },
  })
}
async function call(method = 'GET', query: Record<string, string> = {}) {
  const { req, res } = createMocks({ method: method as never, query })
  await handler(req as never, res as never)
  return res
}

describe('GET /api/activity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    asRole('MANAGER')
  })

  it('rejects other methods', async () => {
    const res = await call('POST')
    expect(res._getStatusCode()).toBe(405)
    expect(res.getHeader('Allow')).toBe('GET')
  })

  it('stops when there is no session', async () => {
    ;(requireTenantContext as jest.Mock).mockResolvedValue(null)
    await call()
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled()
  })

  it('forbids roles that cannot view business data', async () => {
    asRole('DRIVER')
    const res = await call()
    expect(res._getStatusCode()).toBe(403)
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled()
  })

  it('rejects an invalid limit', async () => {
    expect((await call('GET', { limit: '-4' }))._getStatusCode()).toBe(400)
  })

  it('returns the workspace feed only, newest first, with titles and parsed metadata', async () => {
    ;(prisma.auditLog.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'a1',
        entityType: 'vehicle',
        action: 'created',
        description: 'Added Truck 1',
        userName: 'Sam',
        userRole: 'MANAGER',
        createdAt: new Date('2026-09-30T10:00:00Z'),
        metadata: '{"plate":"ABC"}',
      },
    ])
    const res = await call('GET', { limit: '5', type: 'vehicle' })
    expect(res._getStatusCode()).toBe(200)
    expect(res.getHeader('Cache-Control')).toBe('private, no-store')
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { AND: [auditWhere, { entityType: 'vehicle' }] },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    expect(res._getJSONData()).toEqual([
      expect.objectContaining({
        id: 'a1',
        title: 'Vehicle Added',
        user: 'Sam',
        timestamp: '2026-09-30T10:00:00.000Z',
      }),
    ])
  })

  it('hides database errors', async () => {
    ;(prisma.auditLog.findMany as jest.Mock).mockRejectedValue(new Error('connection string leaked'))
    const res = await call()
    expect(res._getStatusCode()).toBe(500)
    expect(res._getData()).not.toContain('leaked')
  })
})
