import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/apiAuth', () => ({ requireTenantContext: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: { $transaction: jest.fn() },
}))

import handler from '@/pages/api/intelligence/brief'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const NOW = new Date('2026-08-08T16:00:00.000Z')
const context = {
  session: { user: { id: 'member-1' } },
  tenant: { ownerId: 'owner-1', teamId: 'team-1', role: 'MANAGER', resourceWhere: { teamId: 'team-1' } },
}
const scope = { ownerId: 'owner-1', teamId: 'team-1' }

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'finding-1',
    type: 'delivery-late',
    severity: 'high',
    confidence: 0.9,
    score: 500,
    ruleVersion: 'v1',
    title: 'Late delivery',
    explanation: 'Delivery is late.',
    evidence: JSON.stringify({
      items: [
        {
          entityType: 'delivery',
          entityId: 'd-1',
          field: 'scheduledTime',
          value: 'late',
          timestamp: NOW.toISOString(),
        },
      ],
      total: 1,
      truncated: false,
    }),
    action: 'Review delivery',
    actionUrl: '/deliveries?record=d-1',
    status: 'OPEN',
    feedback: null,
    generatedAt: NOW,
    expiresAt: new Date('2026-08-09T16:00:00.000Z'),
    resolvedAt: null,
    ...overrides,
  }
}

describe('/api/intelligence/brief', () => {
  let tx: {
    intelligenceFinding: { findMany: jest.Mock; count: jest.Mock }
    intelligenceRun: { findUnique: jest.Mock }
  }
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers().setSystemTime(NOW)
    ;(requireTenantContext as jest.Mock).mockResolvedValue(context)
    tx = {
      intelligenceFinding: { findMany: jest.fn().mockResolvedValue([row()]), count: jest.fn().mockResolvedValue(7) },
      intelligenceRun: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'team:team-1',
          ...scope,
          generatedAt: NOW,
          sourceComplete: true,
          findingsComplete: true,
          reconciliationComplete: true,
          evidenceComplete: true,
          findingTotal: 7,
          sourceCounts: '{"vehicle":12,"delivery":12,"maintenance":12,"client":12}',
        }),
      },
    }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback: (value: typeof tx) => unknown) =>
      callback(tx)
    )
  })
  afterEach(() => jest.useRealTimers())

  it('returns only five current open exact-workspace findings in deterministic order', async () => {
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(200)
    expect(tx.intelligenceFinding.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ...scope, status: 'OPEN', OR: [{ expiresAt: null }, { expiresAt: { gt: NOW } }] },
        orderBy: [{ score: 'desc' }, { id: 'asc' }],
        take: 5,
      })
    )
    expect(tx.intelligenceFinding.count).toHaveBeenCalledWith({ where: expect.objectContaining(scope) })
    expect(tx.intelligenceRun.findUnique).toHaveBeenCalledWith({ where: { id: 'team:team-1' } })
    expect(res._getJSONData()).toEqual(
      expect.objectContaining({
        totalOpen: 7,
        generatedAt: NOW.toISOString(),
        capabilities: { refresh: true, manage: true, feedback: true },
      })
    )
  })

  it('never exposes invalid evidence or unsafe action URLs and reports incomplete coverage', async () => {
    tx.intelligenceFinding.findMany.mockResolvedValue([
      row({ evidence: '{secret raw json', actionUrl: 'https://evil.example/phish' }),
    ])
    tx.intelligenceRun.findUnique.mockResolvedValue({
      ...(await tx.intelligenceRun.findUnique()),
      sourceComplete: false,
      evidenceComplete: false,
    })
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    const body = res._getJSONData()
    expect(body.findings[0]).toEqual(expect.objectContaining({ evidence: [], evidenceValid: false, actionUrl: null }))
    expect(JSON.stringify(body)).not.toContain('secret raw json')
    expect(body.coverage).toEqual(
      expect.objectContaining({ complete: false, sourceTruncated: true, evidenceComplete: false })
    )
  })

  it('removes evidence fields that could contain personal contact data', async () => {
    tx.intelligenceFinding.findMany.mockResolvedValue([
      row({
        evidence: JSON.stringify({
          items: [
            { entityType: 'client', entityId: 'c-1', field: 'email', value: 'private@example.test', timestamp: null },
          ],
          total: 1,
          truncated: false,
        }),
      }),
    ])
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    expect(res._getJSONData().findings[0]).toEqual(expect.objectContaining({ evidence: [], evidenceValid: false }))
    expect(res._getData()).not.toContain('private@example.test')
  })

  it('uses the same redacted presentation envelope as the full findings route', async () => {
    const evidence = JSON.stringify({
      items: [{ entityType: 'client', entityId: 'c-1', field: 'phone', value: '555-0100', timestamp: null }],
      total: 1,
      truncated: false,
    })
    tx.intelligenceFinding.findMany.mockResolvedValue([row({ evidence })])
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    expect(res._getJSONData().findings[0]).toEqual(
      expect.objectContaining({ evidence: [], evidenceValid: false, evidenceTruncated: true })
    )
    expect(res._getData()).not.toContain('555-0100')
  })

  it('marks the brief stale from persisted run metadata and treats never-generated empty state as incomplete', async () => {
    tx.intelligenceRun.findUnique.mockResolvedValue({
      ...(await tx.intelligenceRun.findUnique()),
      generatedAt: new Date('2026-08-07T15:59:59Z'),
    })
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    expect(res._getJSONData().stale).toBe(true)
    tx.intelligenceFinding.findMany.mockResolvedValue([])
    tx.intelligenceFinding.count.mockResolvedValue(0)
    tx.intelligenceRun.findUnique.mockResolvedValue(null)
    const never = createMocks({ method: 'GET' })
    await handler(never.req as never, never.res as never)
    expect(never.res._getJSONData()).toEqual(
      expect.objectContaining({
        generatedAt: null,
        stale: true,
        coverage: expect.objectContaining({ complete: false, reason: 'NEVER_GENERATED' }),
      })
    )
  })

  it('returns read capabilities for viewers and rejects non-GET methods before auth', async () => {
    ;(requireTenantContext as jest.Mock).mockResolvedValue({
      ...context,
      tenant: { ...context.tenant, role: 'VIEWER' },
    })
    let mocks = createMocks({ method: 'GET' })
    await handler(mocks.req as never, mocks.res as never)
    expect(mocks.res._getJSONData().capabilities).toEqual({ refresh: false, manage: false, feedback: true })

    jest.clearAllMocks()
    mocks = createMocks({ method: 'POST' })
    await handler(mocks.req as never, mocks.res as never)
    expect(mocks.res._getStatusCode()).toBe(405)
    expect(mocks.res.getHeader('Allow')).toBe('GET')
    expect(requireTenantContext).not.toHaveBeenCalled()
  })

  it('returns a sanitized retryable database error', async () => {
    tx.intelligenceFinding.findMany.mockRejectedValue(new Error('database password'))
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(500)
    expect(res._getJSONData()).toEqual({ error: 'Unable to load intelligence brief' })
    expect(res._getData()).not.toContain('password')
    spy.mockRestore()
  })
})
