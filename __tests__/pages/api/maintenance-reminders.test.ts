import { createMocks } from 'node-mocks-http'

const mockTransaction = {
  maintenanceTask: { updateMany: jest.fn() },
  notification: { create: jest.fn() },
}

jest.mock('@/lib/prisma', () => ({
  prisma: {
    maintenanceTask: { findMany: jest.fn() },
    $transaction: jest.fn((callback: (client: typeof mockTransaction) => unknown) =>
      callback(mockTransaction)
    ),
  },
}))
jest.mock('@/lib/email.server', () => ({
  notifyMaintenanceDue: jest.fn(() => Promise.resolve()),
}))

import handler from '@/pages/api/cron/maintenance-reminders'
import { prisma } from '@/lib/prisma'
import { notifyMaintenanceDue } from '@/lib/email.server'

const secret = 's'.repeat(32)
const task = {
  id: 'task-1',
  ownerId: 'owner-1',
  title: 'Oil change',
  vehicleName: 'Van 1',
  dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
  owner: { id: 'owner-1', email: 'owner@example.com', name: 'Owner' },
  vehicle: { name: 'Van 1' },
}

describe('POST /api/cron/maintenance-reminders', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = secret
    ;(prisma.maintenanceTask.findMany as jest.Mock).mockResolvedValue([task])
    mockTransaction.notification.create.mockResolvedValue({ id: 'notification-1' })
  })

  afterAll(() => {
    delete process.env.CRON_SECRET
  })

  it('creates the notification and email only after atomically claiming the task', async () => {
    mockTransaction.maintenanceTask.updateMany.mockResolvedValue({ count: 1 })
    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'x-cron-secret': secret },
    })

    await handler(req as never, res as never)

    expect(mockTransaction.maintenanceTask.updateMany).toHaveBeenCalledWith({
      where: { id: 'task-1', completed: false, reminderSentAt: null },
      data: { reminderSentAt: expect.any(Date) },
    })
    expect(mockTransaction.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'owner-1',
        type: 'MAINTENANCE_DUE',
        data: expect.stringContaining('"taskId":"task-1"'),
      }),
    })
    expect(notifyMaintenanceDue).toHaveBeenCalledTimes(1)
    expect(JSON.parse(res._getData()).remindersSent).toBe(1)
  })

  it('does not notify when another invocation already claimed the candidate', async () => {
    mockTransaction.maintenanceTask.updateMany.mockResolvedValue({ count: 0 })
    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'x-cron-secret': secret },
    })

    await handler(req as never, res as never)

    expect(mockTransaction.notification.create).not.toHaveBeenCalled()
    expect(notifyMaintenanceDue).not.toHaveBeenCalled()
    expect(JSON.parse(res._getData()).remindersSent).toBe(0)
  })

  it('rejects a configured cron secret shorter than the production minimum', async () => {
    process.env.CRON_SECRET = 'short'
    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'x-cron-secret': 'short' },
    })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(401)
    expect(prisma.maintenanceTask.findMany).not.toHaveBeenCalled()
  })
})
