import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/apiAuth', () => ({
  requireTenantContext: jest.fn(),
  assertSameOrigin: jest.fn(() => true),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    vehicle: { findMany: jest.fn() }, delivery: { findMany: jest.fn() },
    maintenanceTask: { findMany: jest.fn() }, client: { findMany: jest.fn() },
    intelligenceFinding: { findMany: jest.fn() }, $transaction: jest.fn(),
  },
}))

import handler, { FINDING_SOURCE_LIMIT, parseStoredEvidence } from '@/pages/api/intelligence/findings'
import { assertSameOrigin, requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const NOW = new Date('2026-08-08T16:00:00Z')
const scope = { ownerId: 'owner-1', teamId: 'team-1' }
const resourceWhere = { OR: [{ teamId: 'team-1' }, { ownerId: 'owner-1', teamId: null }] }
const context = {
  session: { user: { id: 'member-1', name: 'Member' } },
  tenant: { ...scope, role: 'MANAGER', resourceWhere },
}

function stored(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fleet-ops-v1:team%3Ateam-1:delivery-unassigned:delivery:d-1',
    ...scope, type: 'delivery-unassigned', severity: 'high', confidence: 0.95,
    score: 500, ruleVersion: 'fleet-ops-v1', title: 'Title', explanation: 'Explanation',
    evidence: '{"items":[],"total":0,"truncated":false}', action: 'Assign',
    actionUrl: '/deliveries?record=d-1', status: 'OPEN', feedback: null,
    generatedAt: NOW, expiresAt: new Date('2026-08-09T16:00:00Z'), resolvedAt: null,
    ...overrides,
  }
}

function createTx() {
  return {
    vehicle: { findMany: jest.fn().mockResolvedValue([]) },
    delivery: { findMany: jest.fn().mockResolvedValue([]) },
    maintenanceTask: { findMany: jest.fn().mockResolvedValue([]) },
    client: { findMany: jest.fn().mockResolvedValue([]) },
    intelligenceFinding: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValue(stored()),
    },
    auditLog: {
      createMany: jest.fn(),
      create: jest.fn(),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
  }
}

describe('/api/intelligence/findings', () => {
  let tx: ReturnType<typeof createTx>
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers().setSystemTime(NOW)
    ;(assertSameOrigin as jest.Mock).mockReturnValue(true)
    ;(requireTenantContext as jest.Mock).mockResolvedValue(context)
    ;(prisma.vehicle.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.delivery.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.maintenanceTask.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.client.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.intelligenceFinding.findMany as jest.Mock).mockResolvedValue([])
    tx = createTx()
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx))
  })
  afterEach(() => jest.useRealTimers())

  it('rejects unsupported methods before authentication', async () => {
    const { req, res } = createMocks({ method: 'DELETE' })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(405)
    expect(res.getHeader('Allow')).toBe('GET, POST, PATCH')
    expect(requireTenantContext).not.toHaveBeenCalled()
  })

  it('returns exact-scope findings with safe evidence and derived expired status', async () => {
    ;(prisma.intelligenceFinding.findMany as jest.Mock).mockResolvedValue([
      stored({ evidence: '{bad', expiresAt: new Date('2026-08-08T15:00:00Z') }),
    ])
    const { req, res } = createMocks({ method: 'GET', query: { status: 'EXPIRED' } })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(200)
    expect(prisma.intelligenceFinding.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [scope, { status: 'OPEN', expiresAt: { lte: NOW } }] },
      orderBy: [{ score: 'desc' }, { id: 'asc' }],
    }))
    expect(res._getJSONData().findings[0]).toEqual(expect.objectContaining({
      evidence: [], evidenceValid: false, evidenceTotal: null,
      evidenceTruncated: true, effectiveStatus: 'EXPIRED', expired: true,
    }))
  })

  it.each([
    [{ status: 'INVALID' }, 'Invalid status filter'],
    [{ status: ['OPEN', 'RESOLVED'] }, 'Invalid status filter'],
    [{ limit: '0' }, 'Invalid limit'],
    [{ limit: ['1', '2'] }, 'Invalid limit'],
  ])('rejects invalid GET query %j before querying', async (query, error) => {
    const { req, res } = createMocks({ method: 'GET', query })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(400)
    expect(res._getJSONData()).toEqual({ error })
    expect(prisma.intelligenceFinding.findMany).not.toHaveBeenCalled()
  })

  it('returns a sanitized GET database error', async () => {
    ;(prisma.intelligenceFinding.findMany as jest.Mock).mockRejectedValue(new Error('database secret'))
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(500)
    expect(res._getJSONData()).toEqual({ error: 'Unable to load findings' })
    expect(res._getData()).not.toContain('secret')
    spy.mockRestore()
  })

  it('regenerates from bounded server data and ignores client-supplied findings', async () => {
    tx.delivery.findMany.mockResolvedValue([{
      id: 'd-1', status: 'pending', driver: null, vehicleId: null,
      scheduledTime: null, estimatedArrival: null, contactPerson: null, updatedAt: NOW,
    }])
    const { req, res } = createMocks({
      method: 'POST', headers: { host: 'x', origin: 'http://x' },
      body: { findings: [{ id: 'attacker' }] },
    })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(200)
    for (const model of [tx.vehicle, tx.delivery, tx.maintenanceTask, tx.client]) {
      expect(model.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: resourceWhere, orderBy: { id: 'asc' }, take: FINDING_SOURCE_LIMIT + 1,
      }))
    }
    const creates = tx.intelligenceFinding.createMany.mock.calls[0][0].data
    expect(creates.length).toBeGreaterThan(0)
    expect(creates).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 'attacker' })]))
    expect(creates[0]).toEqual(expect.objectContaining(scope))
    expect(tx.auditLog.createMany).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(tx.auditLog.createMany.mock.calls)).not.toContain('Member')
  })

  it('never auto-resolves unseen findings when source coverage is truncated', async () => {
    tx.vehicle.findMany.mockResolvedValue(
      Array.from({ length: FINDING_SOURCE_LIMIT + 1 }, (_, index) => ({
        id: `v-${index}`, status: 'inactive', updatedAt: NOW, lastUpdated: NOW,
      }))
    )
    tx.intelligenceFinding.findMany.mockResolvedValue([stored({ id: 'unseen' })])
    const { req, res } = createMocks({ method: 'POST', headers: { host: 'x', origin: 'http://x' } })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData().coverage).toEqual(expect.objectContaining({ complete: false, sourceTruncated: true }))
    expect(tx.intelligenceFinding.updateMany).not.toHaveBeenCalled()
  })

  it('auto-resolves absent open findings with one atomic update and bulk audit', async () => {
    tx.intelligenceFinding.findMany.mockResolvedValue([stored({ id: 'gone' })])
    tx.intelligenceFinding.updateMany.mockResolvedValue({ count: 1 })
    const { req, res } = createMocks({ method: 'POST', headers: { host: 'x', origin: 'http://x' } })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(200)
    expect(tx.intelligenceFinding.updateMany).toHaveBeenCalledWith({
      where: { AND: [scope, { id: { in: ['gone'] }, status: 'OPEN' }] },
      data: { status: 'RESOLVED', resolvedAt: NOW },
    })
    expect(tx.auditLog.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ action: 'auto_resolved', entityId: 'gone' })],
    })
  })

  it('maps repeated primary-key collision to a sanitized conflict after one retry', async () => {
    tx.delivery.findMany.mockResolvedValue([{
      id: 'd-1', status: 'pending', driver: null, vehicleId: null, updatedAt: NOW,
    }])
    tx.intelligenceFinding.createMany.mockRejectedValue(Object.assign(new Error('other tenant'), { code: 'P2002' }))
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const { req, res } = createMocks({ method: 'POST', headers: { host: 'x', origin: 'http://x' } })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(409)
    expect(res._getJSONData()).toEqual({ error: 'Finding identity conflict; regeneration was not applied' })
    expect(prisma.$transaction).toHaveBeenCalledTimes(2)
    expect(res._getData()).not.toContain('other tenant')
    spy.mockRestore()
  })

  it.each(['MEMBER', 'VIEWER'])('forbids %s regeneration', async role => {
    ;(requireTenantContext as jest.Mock).mockResolvedValue({ ...context, tenant: { ...context.tenant, role } })
    const { req, res } = createMocks({ method: 'POST', headers: { host: 'x', origin: 'http://x' } })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(403)
    expect(prisma.vehicle.findMany).not.toHaveBeenCalled()
  })

  it('checks same origin before authenticating mutations', async () => {
    ;(assertSameOrigin as jest.Mock).mockReturnValue(false)
    const { req, res } = createMocks({ method: 'POST', headers: { host: 'x', origin: 'http://evil' } })
    await handler(req as never, res as never)
    expect(requireTenantContext).not.toHaveBeenCalled()
  })

  it.each([
    ['HELPFUL', 'VIEWER', 'feedback_recorded'], ['NOT_HELPFUL', 'MEMBER', 'feedback_recorded'],
    ['DISMISS', 'MANAGER', 'dismissed'], ['RESOLVE', 'ADMIN', 'resolved'],
  ])('applies allowlisted %s tenant-safely for %s', async (action, role, auditAction) => {
    ;(requireTenantContext as jest.Mock).mockResolvedValue({ ...context, tenant: { ...context.tenant, role } })
    const { req, res } = createMocks({
      method: 'PATCH', headers: { host: 'x', origin: 'http://x' },
      body: { id: stored().id, action, status: 'ATTACKER', feedback: 'ATTACKER' },
    })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(200)
    expect(tx.intelligenceFinding.findFirst).toHaveBeenCalledWith({
      where: { AND: [{ id: stored().id }, scope] },
    })
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: auditAction, entityId: stored().id }),
    })
  })

  it.each(['DISMISS', 'RESOLVE'])('forbids viewers from %s', async action => {
    ;(requireTenantContext as jest.Mock).mockResolvedValue({ ...context, tenant: { ...context.tenant, role: 'VIEWER' } })
    const { req, res } = createMocks({ method: 'PATCH', headers: { host: 'x', origin: 'http://x' }, body: { id: 'x', action } })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it.each([
    [{ id: '', action: 'HELPFUL' }, 'Invalid finding ID'],
    [{ id: 'x\ny', action: 'HELPFUL' }, 'Invalid finding ID'],
    [{ id: 'x', action: 'LIKE' }, 'Invalid action'],
  ])('rejects invalid PATCH body %j', async (body, error) => {
    const { req, res } = createMocks({ method: 'PATCH', headers: { host: 'x', origin: 'http://x' }, body })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(400)
    expect(res._getJSONData()).toEqual({ error })
  })

  it('does not reveal a foreign finding ID', async () => {
    tx.intelligenceFinding.findFirst.mockResolvedValue(null)
    const { req, res } = createMocks({ method: 'PATCH', headers: { host: 'x', origin: 'http://x' }, body: { id: 'foreign', action: 'HELPFUL' } })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(404)
    expect(res._getJSONData()).toEqual({ error: 'Finding not found' })
  })
})

describe('parseStoredEvidence', () => {
  it('rejects invalid raw data without returning it', () => {
    for (const value of [
      'x'.repeat(16_385), '{}',
      '[{"entityType":"vehicle","entityId":"v","field":"x","value":{},"timestamp":null}]',
      '[{"entityType":"vehicle","entityId":"v","field":"x","value":null,"timestamp":null,"secret":"x"}]',
    ]) expect(parseStoredEvidence(value)).toEqual({
      evidence: [], valid: false, evidenceTotal: null, evidenceTruncated: true,
    })
  })
})
