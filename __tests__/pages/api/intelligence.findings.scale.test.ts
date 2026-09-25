import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/apiAuth', () => ({
  requireTenantContext: jest.fn(),
  assertSameOrigin: jest.fn(() => true),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    vehicle: { findMany: jest.fn() },
    delivery: { findMany: jest.fn() },
    maintenanceTask: { findMany: jest.fn() },
    client: { findMany: jest.fn() },
    intelligenceFinding: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import handler, {
  FINDING_PERSIST_LIMIT,
  FINDING_RECONCILE_LIMIT,
  FINDING_SOURCE_LIMIT,
  FINDING_TRANSACTION_MAX_WAIT_MS,
  FINDING_TRANSACTION_TIMEOUT_MS,
} from '@/pages/api/intelligence/findings'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const resourceWhere = { OR: [{ teamId: 'team-1' }, { ownerId: 'owner-1', teamId: null }] }
const context = {
  session: { user: { id: 'manager-1' } },
  tenant: { ownerId: 'owner-1', teamId: 'team-1', role: 'MANAGER', resourceWhere },
}

function createWriteTx() {
  return {
    vehicle: { findMany: jest.fn().mockResolvedValue([]) },
    delivery: { findMany: jest.fn().mockResolvedValue([]) },
    maintenanceTask: { findMany: jest.fn().mockResolvedValue([]) },
    client: { findMany: jest.fn().mockResolvedValue([]) },
    intelligenceFinding: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    intelligenceRun: { upsert: jest.fn() },
    auditLog: {
      createMany: jest.fn().mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
    },
    $executeRaw: jest.fn(),
  }
}

describe('finding regeneration scale', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers().setSystemTime(new Date('2026-08-08T16:00:00Z'))
    ;(requireTenantContext as jest.Mock).mockResolvedValue(context)
    ;(prisma.vehicle.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.delivery.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.maintenanceTask.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.client.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.intelligenceFinding.findMany as jest.Mock).mockResolvedValue([])
  })

  afterEach(() => jest.useRealTimers())

  it('uses one serializable snapshot and persists the ranked top 500 with O(1) reads and writes', async () => {
    const tx = createWriteTx()
    tx.delivery.findMany.mockResolvedValue(
      Array.from({ length: FINDING_SOURCE_LIMIT }, (_, index) => ({
        id: `d-${index}`,
        status: 'pending',
        driver: null,
        vehicleId: null,
        scheduledTime: null,
        estimatedArrival: null,
        contactPerson: null,
        updatedAt: new Date('2026-08-08T16:00:00Z'),
      }))
    )
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback: (value: typeof tx) => unknown) =>
      callback(tx)
    )
    const { req, res } = createMocks({
      method: 'POST',
      headers: { host: 'x', origin: 'http://x' },
    })
    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData()).toEqual(
      expect.objectContaining({
        generatedTotal: expect.any(Number),
        persistedTotal: FINDING_PERSIST_LIMIT,
        findingsTruncated: true,
        coverage: expect.objectContaining({ complete: false, findingsTruncated: true }),
      })
    )
    expect(res._getJSONData().generatedTotal).toBeGreaterThan(FINDING_PERSIST_LIMIT)
    for (const model of [tx.vehicle, tx.delivery, tx.maintenanceTask, tx.client]) {
      expect(model.findMany).toHaveBeenCalledTimes(1)
      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: resourceWhere,
          take: FINDING_SOURCE_LIMIT + 1,
        })
      )
      expect(model.findMany.mock.invocationCallOrder[0]).toBeGreaterThan(
        (prisma.$transaction as jest.Mock).mock.invocationCallOrder[0]
      )
    }
    expect(tx.intelligenceFinding.findMany).toHaveBeenCalledTimes(1)
    expect(tx.intelligenceFinding.findMany.mock.invocationCallOrder[0]).toBeGreaterThan(
      (prisma.$transaction as jest.Mock).mock.invocationCallOrder[0]
    )
    expect(tx.intelligenceFinding.createMany).toHaveBeenCalledTimes(1)
    expect(tx.intelligenceFinding.createMany.mock.calls[0][0].data).toHaveLength(FINDING_PERSIST_LIMIT)
    expect(tx.auditLog.createMany).toHaveBeenCalledTimes(1)
    expect(tx.$executeRaw).not.toHaveBeenCalled()
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
      maxWait: FINDING_TRANSACTION_MAX_WAIT_MS,
      timeout: FINDING_TRANSACTION_TIMEOUT_MS,
    })
  })

  it('updates 500 heterogeneous existing findings with one parameterized bulk write', async () => {
    const firstTx = createWriteTx()
    firstTx.delivery.findMany.mockResolvedValue(
      Array.from({ length: FINDING_SOURCE_LIMIT }, (_, index) => ({
        id: `d-${index}`,
        status: 'pending',
        driver: null,
        vehicleId: null,
        scheduledTime: null,
        estimatedArrival: null,
        contactPerson: null,
        updatedAt: new Date('2026-08-08T16:00:00Z'),
      }))
    )
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback: (value: typeof firstTx) => unknown) =>
      callback(firstTx)
    )
    const first = createMocks({ method: 'POST', headers: { host: 'x', origin: 'http://x' } })
    await handler(first.req as never, first.res as never)
    const created = firstTx.intelligenceFinding.createMany.mock.calls[0][0].data
    const secondTx = createWriteTx()
    secondTx.delivery.findMany.mockResolvedValue(
      firstTx.delivery.findMany.mock.calls.length ? await firstTx.delivery.findMany.mock.results[0].value : []
    )
    secondTx.intelligenceFinding.findMany.mockResolvedValue(
      created.map((entry: Record<string, unknown>) => ({
        id: entry.id,
        ownerId: entry.ownerId,
        teamId: entry.teamId,
        type: entry.type,
        status: entry.status,
        feedback: entry.feedback,
        ruleVersion: entry.ruleVersion,
        expiresAt: entry.expiresAt,
        resolvedAt: entry.resolvedAt,
      }))
    )
    secondTx.$executeRaw.mockResolvedValue(FINDING_PERSIST_LIMIT)
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback: (value: typeof secondTx) => unknown) =>
      callback(secondTx)
    )
    const second = createMocks({ method: 'POST', headers: { host: 'x', origin: 'http://x' } })
    await handler(second.req as never, second.res as never)
    expect(second.res._getStatusCode()).toBe(200)
    expect(secondTx.intelligenceFinding.createMany).not.toHaveBeenCalled()
    expect(secondTx.$executeRaw).toHaveBeenCalledTimes(1)
    const query = secondTx.$executeRaw.mock.calls[0][0] as { strings: string[] }
    expect(query.strings.join('')).toContain('::timestamp(3)')
    expect(query.strings.join('')).toContain('::double precision')
    expect(secondTx.auditLog.createMany).toHaveBeenCalledTimes(1)
  })

  it('bounds lifecycle reads to generated ids and never scans resolved or dismissed history', async () => {
    const tx = createWriteTx()
    tx.delivery.findMany.mockResolvedValue([
      {
        id: 'd-1',
        status: 'pending',
        driver: null,
        vehicleId: null,
        scheduledTime: null,
        estimatedArrival: null,
        contactPerson: null,
        updatedAt: new Date('2026-08-08T16:00:00Z'),
      },
    ])
    const history = Array.from({ length: 700 }, (_, index) => ({
      id: `history-${index}`,
      ownerId: 'owner-1',
      teamId: 'team-1',
      type: 'HISTORY',
      status: index % 2 ? 'RESOLVED' : 'DISMISSED',
      feedback: null,
      ruleVersion: 'old',
      expiresAt: null,
      resolvedAt: null,
    }))
    tx.intelligenceFinding.findMany.mockImplementation(
      async (args: { where: { AND: Array<Record<string, unknown>> } }) => {
        const idClause = args.where.AND.find((value) => 'id' in value) as { id?: { in?: string[] } } | undefined
        if (idClause?.id?.in) return history.filter((row) => idClause.id?.in?.includes(row.id))
        return []
      }
    )
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback: (value: typeof tx) => unknown) =>
      callback(tx)
    )
    const { req, res } = createMocks({ method: 'POST', headers: { host: 'x', origin: 'http://x' } })
    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(200)
    const lifecycleQuery = tx.intelligenceFinding.findMany.mock.calls[0][0]
    const idIn = lifecycleQuery.where.AND[1].id.in
    expect(idIn.length).toBeLessThanOrEqual(FINDING_PERSIST_LIMIT)
    expect(lifecycleQuery.take).toBe(FINDING_PERSIST_LIMIT)
    expect(lifecycleQuery.where.AND).toContainEqual({ ownerId: 'owner-1', teamId: 'team-1' })
    expect(lifecycleQuery.where.AND).not.toContainEqual(expect.objectContaining({ status: expect.anything() }))
  })

  it('reconciles absent OPEN findings in truthful bounded batches', async () => {
    const makeOpen = (count: number, offset = 0) =>
      Array.from({ length: count }, (_, index) => ({
        id: `open-${String(index + offset).padStart(4, '0')}`,
        ownerId: 'owner-1',
        teamId: 'team-1',
        type: 'STALE',
        status: 'OPEN',
        feedback: null,
        ruleVersion: 'v1',
        expiresAt: null,
        resolvedAt: null,
      }))
    const firstTx = createWriteTx()
    firstTx.intelligenceFinding.findMany.mockResolvedValue(makeOpen(FINDING_RECONCILE_LIMIT + 1))
    firstTx.intelligenceFinding.updateMany.mockResolvedValue({ count: FINDING_RECONCILE_LIMIT })
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback: (value: typeof firstTx) => unknown) =>
      callback(firstTx)
    )
    const first = createMocks({ method: 'POST', headers: { host: 'x', origin: 'http://x' } })
    await handler(first.req as never, first.res as never)

    expect(first.res._getJSONData().coverage).toEqual(
      expect.objectContaining({
        complete: false,
        reconciliationComplete: false,
        reconciliationLimit: FINDING_RECONCILE_LIMIT,
      })
    )
    expect(first.res._getJSONData().autoResolved).toBe(FINDING_RECONCILE_LIMIT)
    expect(firstTx.intelligenceFinding.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { id: 'asc' },
        take: FINDING_RECONCILE_LIMIT + 1,
      })
    )
    expect(firstTx.intelligenceFinding.updateMany.mock.calls[0][0].where.AND[1].id.in).toHaveLength(
      FINDING_RECONCILE_LIMIT
    )
    expect(firstTx.auditLog.createMany.mock.calls[0][0].data).toHaveLength(FINDING_RECONCILE_LIMIT)

    const secondTx = createWriteTx()
    secondTx.intelligenceFinding.findMany.mockResolvedValue(makeOpen(1, FINDING_RECONCILE_LIMIT))
    secondTx.intelligenceFinding.updateMany.mockResolvedValue({ count: 1 })
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback: (value: typeof secondTx) => unknown) =>
      callback(secondTx)
    )
    const second = createMocks({ method: 'POST', headers: { host: 'x', origin: 'http://x' } })
    await handler(second.req as never, second.res as never)
    expect(second.res._getJSONData()).toEqual(expect.objectContaining({ autoResolved: 1 }))
    expect(second.res._getJSONData().coverage).toEqual(
      expect.objectContaining({
        complete: true,
        reconciliationComplete: true,
      })
    )
    expect(secondTx.auditLog.createMany.mock.calls[0][0].data).toHaveLength(1)
  })
})
