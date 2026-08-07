import { createMocks } from 'node-mocks-http'

const mockTx = {
  taskShareLink: { updateMany: jest.fn() },
  maintenanceTask: { update: jest.fn() },
}

jest.mock('@/lib/prisma', () => ({
  prisma: {
    taskShareLink: { findUnique: jest.fn() },
    $transaction: jest.fn((callback: (client: typeof mockTx) => unknown) => callback(mockTx)),
  },
}))
jest.mock('@/lib/rateLimit', () => ({
  getClientIP: jest.fn(() => '127.0.0.1'),
  rateLimitMiddleware: jest.fn(async () => true),
}))

import handler from '@/pages/api/task/[token]'
import { prisma } from '@/lib/prisma'

const activeLink = {
  id: 'link-1',
  token: 'secret',
  taskId: 'task-1',
  ownerId: 'owner-1',
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 60_000),
  revokedAt: null,
  usedAt: null,
  task: {
    id: 'task-1', vehicleName: 'Van 1', type: 'Oil change', dueDate: new Date(),
    priority: 'high', notes: null, estimatedDuration: '1h', serviceProvider: null,
    completed: false, completedDate: null, actualCost: null,
  },
}

describe('public task share API', () => {
  beforeEach(() => jest.clearAllMocks())

  it.each([
    ['expired', { expiresAt: new Date(Date.now() - 1), revokedAt: null }],
    ['revoked', { expiresAt: new Date(Date.now() + 60_000), revokedAt: new Date() }],
  ])('rejects a %s link', async (_label, state) => {
    ;(prisma.taskShareLink.findUnique as jest.Mock).mockResolvedValue({ ...activeLink, ...state })
    const { req, res } = createMocks({ method: 'GET', query: { token: 'secret' } })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(410)
  })

  it('allows only one write and records supported report fields atomically', async () => {
    ;(prisma.taskShareLink.findUnique as jest.Mock).mockResolvedValue(activeLink)
    mockTx.taskShareLink.updateMany.mockResolvedValue({ count: 1 })
    const { req, res } = createMocks({
      method: 'PUT', query: { token: 'secret' },
      body: { actualCost: '123.45', completionNotes: 'Done', markComplete: true },
    })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(200)
    expect(mockTx.taskShareLink.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'link-1', usedAt: null, revokedAt: null }),
    }))
    expect(mockTx.maintenanceTask.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ actualCost: 123.45, notes: 'Done', completed: true }),
    }))
  })

  it('rejects a replayed write', async () => {
    ;(prisma.taskShareLink.findUnique as jest.Mock).mockResolvedValue(activeLink)
    mockTx.taskShareLink.updateMany.mockResolvedValue({ count: 0 })
    const { req, res } = createMocks({ method: 'PUT', query: { token: 'secret' }, body: { completionNotes: 'Again' } })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(410)
    expect(mockTx.maintenanceTask.update).not.toHaveBeenCalled()
  })
})
