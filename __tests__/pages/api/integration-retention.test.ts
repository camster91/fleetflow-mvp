import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(async (callback) => callback((require('@/lib/prisma') as any).prisma)),
    integrationRateLimit: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
    integrationOAuthState: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
    integrationSyncJob: { deleteMany: jest.fn().mockResolvedValue({ count: 4 }) },
    integrationRecord: { deleteMany: jest.fn().mockResolvedValue({ count: 5 }) },
  },
}))

import handler from '@/pages/api/cron/integration-retention'
import { prisma } from '@/lib/prisma'

const secret = 'r'.repeat(32)

describe('integration retention cron', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = secret
  })
  it('rejects unauthenticated cleanup without touching tenant-independent data', async () => {
    const { req, res } = createMocks({ method: 'POST' })
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(401)
    expect((prisma as any).$transaction).not.toHaveBeenCalled()
  })
  it('deletes only bounded expired integration data in one transaction', async () => {
    const { req, res } = createMocks({ method: 'POST', headers: { 'x-cron-secret': secret } })
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res._getData()).deleted).toEqual({ rateLimits: 2, oauthStates: 3, syncJobs: 4, stagedRecords: 5 })
    expect((prisma as any).integrationSyncJob.deleteMany).toHaveBeenCalledWith({
      where: { status: { in: ['COMPLETED', 'FAILED', 'CANCELLED'] }, completedAt: { lt: expect.any(Date) } },
    })
  })
})
