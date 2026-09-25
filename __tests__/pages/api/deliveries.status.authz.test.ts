import { createMocks } from 'node-mocks-http'

jest.mock('../../../lib/auth', () => ({
  getServerSession: jest.fn(),
  authOptions: {},
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    team: { findMany: jest.fn() },
    delivery: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('../../../lib/fleet', () => ({
  dbToDelivery: (d: any) => d,
  logActivity: jest.fn(),
}))

import handler from '../../../pages/api/deliveries/[id]/status'
import { getServerSession } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.team.findMany as jest.Mock).mockResolvedValue([])
})

describe('PATCH /api/deliveries/[id]/status — tenant isolation', () => {
  it('scopes lookup by ownerId (prevents cross-tenant IDOR)', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-a', email: 'a@x.com', name: 'A', role: 'user' },
    })
    ;(prisma.delivery.findFirst as jest.Mock).mockResolvedValue(null)

    const { req, res } = createMocks({
      method: 'PATCH',
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      query: { id: 'delivery-owned-by-b' },
      body: { status: 'in-transit' },
    })

    await handler(req as any, res as any)

    expect(prisma.delivery.findFirst).toHaveBeenCalledWith({
      where: { AND: [{ id: 'delivery-owned-by-b' }, { ownerId: 'user-a', teamId: null }] },
    })
    expect(res._getStatusCode()).toBe(404)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
  it('preserves picked-up and bounded coordinates', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-a', role: 'user' } })
    const delivery = { id: 'd1', customer: 'A', status: 'pending', notes: null, progress: 0, completedTime: null }
    ;(prisma.delivery.findFirst as jest.Mock).mockResolvedValue(delivery)
    const tx = {
      delivery: { update: jest.fn().mockResolvedValue({ ...delivery, status: 'picked-up', progress: 25 }) },
      deliveryEvent: { create: jest.fn() },
    }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: Function) => fn(tx))
    const { req, res } = createMocks({
      method: 'PATCH',
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      query: { id: 'd1' },
      body: { status: 'picked-up', latitude: 43.65, longitude: -79.38 },
    })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(200)
    expect(tx.deliveryEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ latitude: 43.65, longitude: -79.38 }) })
    )
  })
  it.each([
    [91, 0],
    [0, 181],
  ])('rejects out-of-range coordinates', async (latitude, longitude) => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-a', role: 'user' } })
    const { req, res } = createMocks({
      method: 'PATCH',
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      query: { id: 'd1' },
      body: { status: 'failed', latitude, longitude },
    })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(400)
    expect(prisma.delivery.findFirst).not.toHaveBeenCalled()
  })
})
