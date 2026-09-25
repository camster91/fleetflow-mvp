import { createMocks } from 'node-mocks-http'
jest.mock('@/lib/cronAuth', () => ({ isAuthorizedCronRequest: jest.fn(() => true) }))
jest.mock('@/lib/prisma', () => ({ prisma: {
  loginHistory: { deleteMany: jest.fn(async () => ({ count: 1 })) },
  auditLog: { deleteMany: jest.fn(async () => ({ count: 2 })) },
  idempotencyKey: { deleteMany: jest.fn(async () => ({ count: 3 })) },
} }))
import handler from '@/pages/api/cron/cleanup-audit-logs'
import { prisma } from '@/lib/prisma'
import { isAuthorizedCronRequest } from '@/lib/cronAuth'

beforeEach(() => jest.clearAllMocks())

test('retention cron also deletes expired idempotency keys', async () => {
  const before = Date.now()
  const { req, res } = createMocks({ method: 'POST' })
  await handler(req as never, res as never)

  expect(res._getStatusCode()).toBe(200)
  expect(res._getJSONData().deleted).toEqual({ loginHistory: 1, auditLog: 2, idempotencyKeys: 3 })
  const where = (prisma.idempotencyKey.deleteMany as jest.Mock).mock.calls[0][0].where
  expect(where.expiresAt.lt.getTime()).toBeGreaterThanOrEqual(before)
})

test('retention cron rejects unauthorized requests before deleting', async () => {
  ;(isAuthorizedCronRequest as jest.Mock).mockReturnValueOnce(false)
  const { req, res } = createMocks({ method: 'POST' })
  await handler(req as never, res as never)

  expect(res._getStatusCode()).toBe(401)
  expect(prisma.idempotencyKey.deleteMany).not.toHaveBeenCalled()
})
