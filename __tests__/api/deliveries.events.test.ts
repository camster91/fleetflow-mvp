import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/apiAuth', () => ({
  ...jest.requireActual('@/lib/apiAuth'),
  requireTenantContext: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: { delivery: { findFirst: jest.fn() }, deliveryEvent: { findMany: jest.fn() } },
}))

import handler from '@/pages/api/deliveries/[id]/events'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const event = {
  id: 'e1',
  deliveryId: 'd1',
  status: 'IN_TRANSIT',
  timestamp: new Date('2026-09-01T10:00:00Z'),
  latitude: 43.6,
  longitude: -79.4,
  notes: 'Customer phone 555-0100',
  createdById: 'dispatcher',
}

function asRole(role: string) {
  ;(requireTenantContext as jest.Mock).mockResolvedValue({
    session: { user: { id: 'caller' } },
    tenant: { ownerId: 'owner', teamId: 'team-1', role, resourceWhere: { teamId: 'team-1' } },
  })
}

async function get(method = 'GET') {
  const { req, res } = createMocks({ method: method as never, query: { id: 'd1' } })
  await handler(req as never, res as never)
  return res
}

describe('GET /api/deliveries/[id]/events', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.delivery.findFirst as jest.Mock).mockResolvedValue({ id: 'd1' })
    ;(prisma.deliveryEvent.findMany as jest.Mock).mockResolvedValue([event])
  })

  it('rejects other methods', async () => {
    const res = await get('POST')
    expect(res._getStatusCode()).toBe(405)
  })

  it('forbids roles that cannot view deliveries', async () => {
    asRole('TECHNICIAN')
    const res = await get()
    expect(res._getStatusCode()).toBe(403)
    expect(prisma.delivery.findFirst).not.toHaveBeenCalled()
  })

  it('returns 404 for a delivery outside the workspace', async () => {
    asRole('MANAGER')
    ;(prisma.delivery.findFirst as jest.Mock).mockResolvedValue(null)
    const res = await get()
    expect(res._getStatusCode()).toBe(404)
    expect(prisma.deliveryEvent.findMany).not.toHaveBeenCalled()
  })

  it('gives staff the full bounded timeline scoped to the workspace', async () => {
    asRole('MANAGER')
    const res = await get()
    expect(res._getStatusCode()).toBe(200)
    expect(prisma.delivery.findFirst).toHaveBeenCalledWith({ where: { AND: [{ id: 'd1' }, { teamId: 'team-1' }] } })
    expect(prisma.deliveryEvent.findMany).toHaveBeenCalledWith({
      where: { deliveryId: 'd1' },
      orderBy: { timestamp: 'asc' },
      take: 500,
    })
    expect(res._getJSONData()[0].notes).toBe('Customer phone 555-0100')
  })

  it('limits drivers to assigned deliveries and a reduced event shape', async () => {
    asRole('DRIVER')
    const res = await get()
    expect(res._getStatusCode()).toBe(200)
    expect(prisma.delivery.findFirst).toHaveBeenCalledWith({
      where: { AND: [{ id: 'd1' }, { teamId: 'team-1' }, { assignedDriverId: 'caller' }] },
    })
    expect(res._getJSONData()).toEqual([
      { id: 'e1', status: 'IN_TRANSIT', timestamp: '2026-09-01T10:00:00.000Z', latitude: 43.6, longitude: -79.4 },
    ])
  })
})
