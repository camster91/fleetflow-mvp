import { createMocks } from 'node-mocks-http'
jest.mock('@/lib/tokens', () => ({ constantTimeCompare: jest.fn(() => true) }))
jest.mock('@/lib/prisma', () => ({
  prisma: { aiWorkspaceConfig: { findMany: jest.fn() }, aiTelemetryBucket: { deleteMany: jest.fn() } },
}))
import handler from '@/pages/api/cron/ai-retention'
import { prisma } from '@/lib/prisma'
import { constantTimeCompare } from '@/lib/tokens'

test('AI retention cron authenticates and deletes each exact workspace cutoff', async () => {
  process.env.CRON_SECRET = 'x'.repeat(32)
  ;(prisma.aiWorkspaceConfig.findMany as jest.Mock).mockResolvedValue([
    { scopeKey: 'team:a', retentionDays: 7 },
    { scopeKey: 'owner:b', retentionDays: 90 },
  ])
  ;(prisma.aiTelemetryBucket.deleteMany as jest.Mock)
    .mockResolvedValueOnce({ count: 2 })
    .mockResolvedValueOnce({ count: 1 })
  const { req, res } = createMocks({ method: 'POST', headers: { 'x-cron-secret': 'x'.repeat(32) } })
  await handler(req as never, res as never)
  expect(res.statusCode).toBe(200)
  expect(res._getJSONData()).toEqual({ deleted: 3, workspaces: 2 })
  expect(prisma.aiTelemetryBucket.deleteMany).toHaveBeenCalledTimes(2)
  expect(prisma.aiTelemetryBucket.deleteMany).toHaveBeenNthCalledWith(1, {
    where: { scopeKey: 'team:a', bucketStart: { lt: expect.any(Date) } },
  })
})

test('AI retention cron rejects unauthorized requests before data access', async () => {
  jest.clearAllMocks()
  ;(constantTimeCompare as jest.Mock).mockReturnValue(false)
  const { req, res } = createMocks({ method: 'POST', headers: { 'x-cron-secret': 'wrong' } })
  await handler(req as never, res as never)
  expect(res.statusCode).toBe(401)
  expect(prisma.aiWorkspaceConfig.findMany).not.toHaveBeenCalled()
})

test('paginates beyond ten thousand workspaces with bounded keyset pages', async () => {
  jest.clearAllMocks()
  ;(constantTimeCompare as jest.Mock).mockReturnValue(true)
  process.env.CRON_SECRET = 'x'.repeat(32)
  const rows = Array.from({ length: 10001 }, (_, index) => ({
    scopeKey: `team:${String(index).padStart(5, '0')}`,
    retentionDays: 30,
  }))
  let offset = 0
  ;(prisma.aiWorkspaceConfig.findMany as jest.Mock).mockImplementation(async () => {
    const page = rows.slice(offset, offset + 500)
    offset += page.length
    return page
  })
  ;(prisma.aiTelemetryBucket.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })
  const { req, res } = createMocks({ method: 'POST', headers: { 'x-cron-secret': 'x'.repeat(32) } })
  await handler(req as never, res as never)
  expect(res._getJSONData().workspaces).toBe(10001)
  expect(prisma.aiWorkspaceConfig.findMany).toHaveBeenCalledTimes(21)
  expect((prisma.aiWorkspaceConfig.findMany as jest.Mock).mock.calls[1][0]).toEqual(
    expect.objectContaining({ take: 500, skip: 1, cursor: { scopeKey: 'team:00499' } })
  )
})
