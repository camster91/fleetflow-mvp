import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/apiAuth', () => ({
  requireTenantContext: jest.fn(),
  assertSameOrigin: jest.fn(() => true),
}))
jest.mock('@/lib/prisma', () => ({ prisma: { $transaction: jest.fn() } }))

import handler from '@/pages/api/intelligence/findings'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const NOW = new Date('2026-08-08T16:00:00Z')
const scope = { ownerId: 'owner-1', teamId: 'team-1' }
const resourceWhere = { OR: [{ teamId: 'team-1' }, { ownerId: 'owner-1', teamId: null }] }
const context = {
  session: { user: { id: 'manager-1' } },
  tenant: { ...scope, role: 'MANAGER', resourceWhere },
}
const deliveryFindingId = 'fleet-ops-v1:team%3Ateam-1:delivery-unassigned:delivery:d-1'

function existing(overrides: Record<string, unknown> = {}) {
  return {
    id: deliveryFindingId,
    ...scope,
    type: 'delivery-unassigned',
    status: 'OPEN',
    feedback: null,
    ruleVersion: 'fleet-ops-v1',
    expiresAt: new Date('2026-08-08T20:00:00Z'),
    resolvedAt: null,
    ...overrides,
  }
}

function transactionState(
  options: {
    deliveries?: unknown[]
    existing?: unknown[]
    resolveConflict?: boolean
    updateConflict?: boolean
  } = {}
) {
  return {
    vehicle: { findMany: jest.fn().mockResolvedValue([]) },
    delivery: { findMany: jest.fn().mockResolvedValue(options.deliveries ?? []) },
    maintenanceTask: { findMany: jest.fn().mockResolvedValue([]) },
    client: { findMany: jest.fn().mockResolvedValue([]) },
    intelligenceFinding: {
      findMany: jest.fn().mockResolvedValue(options.existing ?? []),
      createMany: jest.fn().mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
      updateMany: jest.fn().mockImplementation(async () => {
        if (options.resolveConflict) throw Object.assign(new Error('serialization conflict'), { code: 'P2034' })
        return { count: 1 }
      }),
    },
    intelligenceRun: { upsert: jest.fn() },
    auditLog: { createMany: jest.fn() },
    $executeRaw: jest.fn().mockImplementation(async () => {
      if (options.updateConflict) throw Object.assign(new Error('serialization conflict'), { code: 'P2034' })
      return (options.existing ?? []).length
    }),
  }
}

const delivery = {
  id: 'd-1',
  status: 'pending',
  driver: null,
  vehicleId: null,
  scheduledTime: null,
  estimatedArrival: null,
  contactPerson: null,
  updatedAt: NOW,
}

describe('finding regeneration serializable interleavings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers().setSystemTime(NOW)
    ;(requireTenantContext as jest.Mock).mockResolvedValue(context)
  })
  afterEach(() => jest.useRealTimers())

  it('retries the whole snapshot so stale A cannot resolve the OPEN finding created by B', async () => {
    const staleA = transactionState({ existing: [existing({ id: 'gone' })], resolveConflict: true })
    const afterB = transactionState({ deliveries: [delivery], existing: [existing()] })
    ;(prisma.$transaction as jest.Mock)
      .mockImplementationOnce(async (callback: (tx: typeof staleA) => unknown) => callback(staleA))
      .mockImplementationOnce(async (callback: (tx: typeof afterB) => unknown) => callback(afterB))
    const { req, res } = createMocks({ method: 'POST', headers: { host: 'x', origin: 'http://x' } })
    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(200)
    expect(prisma.$transaction).toHaveBeenCalledTimes(2)
    expect(staleA.intelligenceFinding.updateMany).toHaveBeenCalled()
    expect(afterB.delivery.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: resourceWhere }))
    expect(afterB.intelligenceFinding.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: expect.arrayContaining([scope]) },
      })
    )
    expect(afterB.intelligenceFinding.updateMany).not.toHaveBeenCalled()
    expect(afterB.$executeRaw).toHaveBeenCalledTimes(1)
    expect((afterB.$executeRaw.mock.calls[0][0] as { values: unknown[] }).values).toContain('OPEN')
  })

  it('retries from the concurrent dismissal and keeps its original expiry', async () => {
    const originalExpiry = new Date('2026-08-08T18:00:00Z')
    const beforeDismissal = transactionState({ deliveries: [delivery], existing: [existing()], updateConflict: true })
    const afterDismissal = transactionState({
      deliveries: [delivery],
      existing: [existing({ status: 'DISMISSED', expiresAt: originalExpiry })],
    })
    ;(prisma.$transaction as jest.Mock)
      .mockImplementationOnce(async (callback: (tx: typeof beforeDismissal) => unknown) => callback(beforeDismissal))
      .mockImplementationOnce(async (callback: (tx: typeof afterDismissal) => unknown) => callback(afterDismissal))
    const { req, res } = createMocks({ method: 'POST', headers: { host: 'x', origin: 'http://x' } })
    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(200)
    expect(beforeDismissal.auditLog.createMany).not.toHaveBeenCalled()
    const values = (afterDismissal.$executeRaw.mock.calls[0][0] as { values: unknown[] }).values
    expect(values).toContain('DISMISSED')
    expect(values).toContain(originalExpiry)
    expect(afterDismissal.auditLog.createMany).toHaveBeenCalledTimes(1)
  })
})
