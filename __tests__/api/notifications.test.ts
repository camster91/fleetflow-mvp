import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/auth', () => ({
  getServerSession: jest.fn(async () => ({ user: { id: 'user-1' } })),
  authOptions: {},
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}))

import handler from '@/pages/api/notifications'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/auth'

describe('notifications API contracts', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 without a session and never queries notifications', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValueOnce(null)
    const { req, res } = createMocks({ method: 'GET' })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(401)
    expect(prisma.notification.findMany).not.toHaveBeenCalled()
  })

  it('returns cursor metadata without exposing another user', async () => {
    ;(prisma.notification.findMany as jest.Mock).mockResolvedValue([{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }])
    ;(prisma.notification.count as jest.Mock).mockResolvedValue(3)
    const { req, res } = createMocks({ method: 'GET', query: { limit: '2' } })

    await handler(req as never, res as never)

    expect(res._getJSONData()).toMatchObject({
      notifications: [{ id: 'n1' }, { id: 'n2' }],
      hasMore: true,
      nextCursor: 'n2',
    })
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        take: 3,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    )
  })

  it('deletes a bounded body selection for the authenticated user', async () => {
    const { req, res } = createMocks({
      method: 'DELETE',
      headers: { host: 'fleetflow.test' },
      body: { notificationIds: ['n1', 'n2'] },
    })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(200)
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['n1', 'n2'] }, userId: 'user-1' },
    })
  })

  it('rejects cross-origin mutation requests before writing', async () => {
    const { req, res } = createMocks({
      method: 'DELETE',
      headers: { host: 'fleetflow.test', origin: 'https://attacker.example' },
      body: { notificationIds: ['n1'] },
    })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(403)
    expect(prisma.notification.deleteMany).not.toHaveBeenCalled()
  })

  it.each([
    { notificationIds: 'n1' },
    { notificationIds: Array.from({ length: 101 }, (_, index) => `n${index}`) },
    { notificationId: '' },
  ])('rejects malformed or oversized read selections', async (body) => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: { host: 'fleetflow.test' },
      body,
    })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(400)
    expect(prisma.notification.updateMany).not.toHaveBeenCalled()
  })

  it('rejects a cursor that is not owned by the authenticated user', async () => {
    ;(prisma.notification.findFirst as jest.Mock).mockResolvedValue(null)
    const { req, res } = createMocks({ method: 'GET', query: { cursor: 'another-users-notification' } })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(400)
    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: { id: 'another-users-notification', userId: 'user-1' },
      select: { id: true },
    })
    expect(prisma.notification.findMany).not.toHaveBeenCalled()
  })

  it('rejects an invalid notification type filter', async () => {
    const { req, res } = createMocks({ method: 'GET', query: { type: 'other-user-data' } })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(400)
    expect(prisma.notification.findMany).not.toHaveBeenCalled()
  })
})
