import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/apiAuth', () => ({
  requireTenantContext: jest.fn(),
  assertSameOrigin: jest.fn(() => true),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: { $transaction: jest.fn() },
}))

import handler, {
  FINDING_TRANSACTION_MAX_WAIT_MS,
  FINDING_TRANSACTION_TIMEOUT_MS,
} from '@/pages/api/intelligence/findings'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const NOW = new Date('2026-08-08T16:00:00Z')
const scope = { ownerId: 'owner-1', teamId: 'team-1' }
const context = {
  session: { user: { id: 'manager-1' } },
  tenant: { ...scope, role: 'MANAGER', resourceWhere: scope },
}

function finding() {
  return {
    id: 'finding-1', ...scope, type: 'vehicle-stale', status: 'OPEN', feedback: null,
    ruleVersion: 'fleet-ops-v1', expiresAt: new Date('2026-08-09T00:00:00Z'), resolvedAt: null,
    severity: 'medium', confidence: 0.9, score: 300, title: 'Title', explanation: 'Explanation',
    evidence: '{"items":[],"total":0,"truncated":false}', action: 'Review', actionUrl: '/vehicles',
    generatedAt: NOW,
  }
}

function createTx(count = 1) {
  return {
    intelligenceFinding: {
      findFirst: jest.fn().mockResolvedValue(finding()),
      updateMany: jest.fn().mockResolvedValue({ count }),
    },
    auditLog: { create: jest.fn() },
  }
}

describe('finding PATCH concurrency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers().setSystemTime(NOW)
    ;(requireTenantContext as jest.Mock).mockResolvedValue(context)
  })
  afterEach(() => jest.useRealTimers())

  it('retries one P2034 using explicit transaction limits and audits only the successful attempt', async () => {
    const tx = createTx()
    const conflict = Object.assign(new Error('serialization'), { code: 'P2034' })
    ;(prisma.$transaction as jest.Mock)
      .mockRejectedValueOnce(conflict)
      .mockImplementationOnce(async (callback: (value: typeof tx) => unknown) => callback(tx))
    const { req, res } = createMocks({
      method: 'PATCH', headers: { host: 'x', origin: 'http://x' },
      body: { id: 'finding-1', action: 'RESOLVE' },
    })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(200)
    expect(prisma.$transaction).toHaveBeenCalledTimes(2)
    expect(prisma.$transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
      maxWait: FINDING_TRANSACTION_MAX_WAIT_MS,
      timeout: FINDING_TRANSACTION_TIMEOUT_MS,
    })
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1)
  })

  it('conditionally updates the observed lifecycle and rolls back without a false audit on mismatch', async () => {
    const tx = createTx(0)
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx))
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const { req, res } = createMocks({
      method: 'PATCH', headers: { host: 'x', origin: 'http://x' },
      body: { id: 'finding-1', action: 'DISMISS' },
    })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(500)
    expect(prisma.$transaction).toHaveBeenCalledTimes(2)
    expect(tx.intelligenceFinding.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'finding-1', ...scope, status: 'OPEN', feedback: null,
        expiresAt: finding().expiresAt, resolvedAt: null,
      },
      data: { status: 'DISMISSED', resolvedAt: null },
    })
    expect(tx.auditLog.create).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
