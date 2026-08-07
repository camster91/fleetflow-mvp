import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/auth', () => ({
  getServerSession: jest.fn(async () => ({ user: { id: 'user-1' } })), authOptions: {},
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      findMany: jest.fn(), count: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn(),
    },
  },
}))

import handler from '@/pages/api/notifications'
import { prisma } from '@/lib/prisma'

describe('notifications API contracts', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns cursor metadata without exposing another user', async () => {
    ;(prisma.notification.findMany as jest.Mock).mockResolvedValue([
      { id: 'n1' }, { id: 'n2' }, { id: 'n3' },
    ])
    ;(prisma.notification.count as jest.Mock).mockResolvedValue(3)
    const { req, res } = createMocks({ method: 'GET', query: { limit: '2' } })

    await handler(req as never, res as never)

    expect(res._getJSONData()).toMatchObject({
      notifications: [{ id: 'n1' }, { id: 'n2' }], hasMore: true, nextCursor: 'n2',
    })
    expect(prisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1' }, take: 3,
    }))
  })

  it('deletes a bounded body selection for the authenticated user', async () => {
    const { req, res } = createMocks({
      method: 'DELETE', body: { notificationIds: ['n1', 'n2'] },
    })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(200)
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['n1', 'n2'] }, userId: 'user-1' },
    })
  })
})
