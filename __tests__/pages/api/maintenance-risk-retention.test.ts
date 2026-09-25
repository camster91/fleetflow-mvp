import { createMocks } from 'node-mocks-http'
jest.mock('@/lib/prisma', () => ({ prisma: { $transaction: jest.fn() } }))
import handler from '@/pages/api/cron/maintenance-risk-retention'
import { prisma } from '@/lib/prisma'
describe('maintenance risk feedback retention', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = 'x'.repeat(32)
  })
  it('requires the cron secret and deletes only expired feedback with an aggregate audit', async () => {
    let mock = createMocks({ method: 'POST', headers: { authorization: 'Bearer wrong' } })
    await handler(mock.req as never, mock.res as never)
    expect(mock.res._getStatusCode()).toBe(401)
    const del = jest.fn().mockResolvedValue({ count: 3 })
    const audit = jest.fn().mockResolvedValue({})
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: Function) =>
      fn({ maintenanceRiskFeedback: { deleteMany: del }, auditLog: { create: audit } })
    )
    mock = createMocks({ method: 'POST', headers: { authorization: `Bearer ${'x'.repeat(32)}` } })
    await handler(mock.req as never, mock.res as never)
    expect(mock.res._getStatusCode()).toBe(200)
    expect(del).toHaveBeenCalledWith({ where: { expiresAt: { lte: expect.any(Date) } } })
    expect(audit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'pilot_feedback_retention_cleanup',
        metadata: JSON.stringify({ deleted: 3 }),
      }),
    })
  })
})
