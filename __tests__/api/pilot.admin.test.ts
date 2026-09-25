import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/apiAuth', () => ({
  ...jest.requireActual('@/lib/apiAuth'),
  requireTenantContext: jest.fn(),
}))
jest.mock('@/lib/rateLimit', () => ({ rateLimitMiddleware: jest.fn().mockResolvedValue(true) }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    pilotEnrollment: { findUnique: jest.fn(), upsert: jest.fn() },
    pilotIncident: { findMany: jest.fn(), create: jest.fn(), groupBy: jest.fn() },
    pilotEvent: { findMany: jest.fn() },
    teamMember: { count: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import enrollment from '@/pages/api/admin/pilot/enrollment'
import incidents from '@/pages/api/admin/pilot/incidents'
import metrics from '@/pages/api/admin/pilot/metrics'
import { requireTenantContext } from '@/lib/apiAuth'
import { rateLimitMiddleware } from '@/lib/rateLimit'
import { prisma } from '@/lib/prisma'

const db = prisma as unknown as Record<string, Record<string, jest.Mock>> & { $transaction: jest.Mock }
const sameOrigin = { host: 'app.test', origin: 'http://app.test' }

function asRole(role: string, teamId: string | null = 'team-1') {
  ;(requireTenantContext as jest.Mock).mockResolvedValue({
    session: { user: { id: 'caller', name: 'Caller', email: 'caller@example.test' } },
    tenant: { ownerId: 'owner', teamId, role, resourceWhere: teamId ? { teamId } : { ownerId: 'owner', teamId: null } },
  })
}

async function call(handler: typeof enrollment, method: string, body?: unknown) {
  const { req, res } = createMocks({ method: method as never, headers: sameOrigin, body: body as never })
  await handler(req as never, res as never)
  return res
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(rateLimitMiddleware as jest.Mock).mockResolvedValue(true)
  db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma))
})

describe.each([
  ['enrollment', enrollment, ['GET', 'PUT']],
  ['incidents', incidents, ['GET', 'POST']],
  ['metrics', metrics, ['GET']],
] as const)('admin pilot %s access control', (_name, handler, methods) => {
  it('rejects unsupported methods with Allow', async () => {
    const res = await call(handler, 'DELETE')
    expect(res._getStatusCode()).toBe(405)
    expect(res.getHeader('Allow')).toBe(methods.join(', '))
    expect(requireTenantContext).not.toHaveBeenCalled()
  })

  it.each(['MANAGER', 'DISPATCHER', 'DRIVER', 'MEMBER', 'VIEWER'])('forbids %s before touching data', async (role) => {
    asRole(role)
    const res = await call(handler, 'GET')
    expect(res._getStatusCode()).toBe(403)
    expect(rateLimitMiddleware).not.toHaveBeenCalled()
    expect(db.pilotEnrollment.findUnique).not.toHaveBeenCalled()
    expect(db.pilotEvent.findMany).not.toHaveBeenCalled()
    expect(db.pilotIncident.findMany).not.toHaveBeenCalled()
  })

  it('stops when unauthenticated', async () => {
    ;(requireTenantContext as jest.Mock).mockResolvedValue(null)
    await call(handler, 'GET')
    expect(rateLimitMiddleware).not.toHaveBeenCalled()
  })

  it('stops when rate limited', async () => {
    asRole('OWNER')
    ;(rateLimitMiddleware as jest.Mock).mockResolvedValue(false)
    await call(handler, 'GET')
    expect(db.pilotEnrollment.findUnique).not.toHaveBeenCalled()
    expect(db.pilotIncident.findMany).not.toHaveBeenCalled()
  })
})

describe('admin pilot writes require same origin', () => {
  it.each([
    ['enrollment', enrollment, 'PUT'],
    ['incidents', incidents, 'POST'],
  ] as const)('%s %s from another origin is rejected', async (_name, handler, method) => {
    asRole('OWNER')
    const { req, res } = createMocks({
      method,
      headers: { host: 'app.test', origin: 'https://evil.test' },
      body: {},
    })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(403)
    expect(requireTenantContext).not.toHaveBeenCalled()
  })
})

describe('/api/admin/pilot/enrollment', () => {
  const row = {
    id: 'enr-1',
    status: 'ACTIVE',
    pilotStartsAt: new Date('2026-09-01T00:00:00Z'),
    pilotEndsAt: null,
    consentedAt: new Date('2026-09-01T00:00:00Z'),
    supportOwnerLabel: 'Ops lead',
    updatedAt: new Date('2026-09-02T00:00:00Z'),
  }

  it('GET returns the workspace enrollment by team scope key', async () => {
    asRole('ADMIN')
    db.pilotEnrollment.findUnique.mockResolvedValue(row)
    const res = await call(enrollment, 'GET')
    expect(res._getStatusCode()).toBe(200)
    expect(db.pilotEnrollment.findUnique).toHaveBeenCalledWith({ where: { scopeKey: 'team:team-1' } })
    expect(res._getJSONData().enrollment).toEqual({
      status: 'ACTIVE',
      pilotStartsAt: '2026-09-01T00:00:00.000Z',
      pilotEndsAt: null,
      consentedAt: '2026-09-01T00:00:00.000Z',
      supportOwnerLabel: 'Ops lead',
      updatedAt: '2026-09-02T00:00:00.000Z',
    })
  })

  it('GET uses the personal scope key without a team and returns null when not enrolled', async () => {
    asRole('OWNER', null)
    db.pilotEnrollment.findUnique.mockResolvedValue(null)
    const res = await call(enrollment, 'GET')
    expect(db.pilotEnrollment.findUnique).toHaveBeenCalledWith({ where: { scopeKey: 'owner:owner' } })
    expect(res._getJSONData()).toEqual({ enrollment: null })
  })

  it.each([
    [{ status: 'ACTIVE', consent: false }],
    [{ status: 'BOGUS', consent: true }],
    [{ status: 'ACTIVE', consent: true, extra: 1 }],
    [
      {
        status: 'INVITED',
        consent: true,
        pilotStartsAt: '2026-10-01T00:00:00Z',
        pilotEndsAt: '2026-09-01T00:00:00Z',
      },
    ],
  ])('PUT rejects invalid body %j', async (body) => {
    asRole('OWNER')
    const res = await call(enrollment, 'PUT', body)
    expect(res._getStatusCode()).toBe(400)
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('PUT upserts with consent and writes an audit log in one transaction', async () => {
    asRole('OWNER')
    db.pilotEnrollment.findUnique.mockResolvedValue(null)
    db.pilotEnrollment.upsert.mockResolvedValue(row)
    const res = await call(enrollment, 'PUT', { status: 'ACTIVE', consent: true, supportOwnerLabel: 'Ops lead' })
    expect(res._getStatusCode()).toBe(200)
    const args = db.pilotEnrollment.upsert.mock.calls[0][0]
    expect(args.where).toEqual({ scopeKey: 'team:team-1' })
    expect(args.create).toMatchObject({
      scopeKey: 'team:team-1',
      ownerId: 'owner',
      teamId: 'team-1',
      status: 'ACTIVE',
      supportOwnerId: 'caller',
      createdById: 'caller',
    })
    expect(args.create.pilotStartsAt).toBeInstanceOf(Date)
    expect(args.create.consentedAt).toBeInstanceOf(Date)
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'PILOT_ENROLLMENT_UPDATED', entityId: 'enr-1', teamId: 'team-1' }),
    })
    expect(res._getJSONData().enrollment.status).toBe('ACTIVE')
  })
})

describe('/api/admin/pilot/incidents', () => {
  it('GET lists at most 100 workspace incidents without free text', async () => {
    asRole('ADMIN')
    db.pilotIncident.findMany.mockResolvedValue([
      {
        id: 'inc-1',
        severity: 'HIGH',
        category: 'SECURITY',
        status: 'OPEN',
        occurredAt: new Date('2026-09-03T00:00:00Z'),
        resolvedAt: null,
      },
    ])
    const res = await call(incidents, 'GET')
    expect(res._getStatusCode()).toBe(200)
    const args = db.pilotIncident.findMany.mock.calls[0][0]
    expect(args.where).toEqual({ scopeKey: 'team:team-1' })
    expect(args.take).toBe(100)
    expect(res._getJSONData().incidents).toEqual([
      {
        id: 'inc-1',
        severity: 'HIGH',
        category: 'SECURITY',
        status: 'OPEN',
        occurredAt: '2026-09-03T00:00:00.000Z',
        resolvedAt: null,
      },
    ])
  })

  it.each([
    [{ severity: 'HIGH' }],
    [{ severity: 'URGENT', category: 'OTHER' }],
    [{ severity: 'LOW', category: 'OTHER', note: 'free text' }],
  ])('POST rejects invalid body %j', async (body) => {
    asRole('OWNER')
    const res = await call(incidents, 'POST', body)
    expect(res._getStatusCode()).toBe(400)
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('POST records a scoped incident with expiry and an audit log', async () => {
    asRole('OWNER')
    db.pilotIncident.create.mockResolvedValue({
      id: 'inc-2',
      severity: 'LOW',
      category: 'USABILITY',
      status: 'OPEN',
      occurredAt: new Date('2026-09-04T00:00:00Z'),
    })
    const res = await call(incidents, 'POST', { severity: 'LOW', category: 'USABILITY' })
    expect(res._getStatusCode()).toBe(201)
    expect(db.pilotIncident.create.mock.calls[0][0].data).toMatchObject({
      scopeKey: 'team:team-1',
      teamId: 'team-1',
      severity: 'LOW',
      category: 'USABILITY',
      createdById: 'caller',
      expiresAt: expect.any(Date),
    })
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'PILOT_INCIDENT_RECORDED', entityId: 'inc-2' }),
    })
    expect(res._getJSONData().incident).toEqual({
      id: 'inc-2',
      severity: 'LOW',
      category: 'USABILITY',
      status: 'OPEN',
      occurredAt: '2026-09-04T00:00:00.000Z',
    })
  })
})

describe('/api/admin/pilot/metrics', () => {
  it('summarises adoption, time to first useful action, and incidents for the workspace', async () => {
    asRole('ADMIN')
    const now = Date.now()
    const at = (msAgo: number) => new Date(now - msAgo)
    db.pilotEnrollment.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      pilotStartsAt: new Date('2026-09-01T00:00:00Z'),
      pilotEndsAt: null,
      consentedAt: new Date('2026-09-01T00:00:00Z'),
      supportOwnerLabel: null,
    })
    db.pilotEvent.findMany.mockResolvedValue([
      { actorId: 'a', sessionKey: 's1', eventType: 'DASHBOARD_OPENED', occurredAt: at(60_000) },
      { actorId: 'a', sessionKey: 's1', eventType: 'FIRST_USEFUL_ACTION', occurredAt: at(30_000) },
      { actorId: 'b', sessionKey: 's2', eventType: 'DASHBOARD_OPENED', occurredAt: at(20_000) },
      // A useful action with no dashboard open in the same session is not timed.
      { actorId: 'c', sessionKey: 's3', eventType: 'FIRST_USEFUL_ACTION', occurredAt: at(10_000) },
    ])
    db.pilotIncident.groupBy.mockResolvedValue([{ severity: 'HIGH', status: 'OPEN', _count: { _all: 2 } }])
    db.teamMember.count.mockResolvedValue(4)

    const res = await call(metrics, 'GET')
    expect(res._getStatusCode()).toBe(200)
    expect(db.teamMember.count).toHaveBeenCalledWith({ where: { teamId: 'team-1', status: 'ACCEPTED' } })
    const body = res._getJSONData()
    expect(body.members).toBe(4)
    expect(body.weekly).toHaveLength(4)
    expect(body.weekly[3]).toMatchObject({ activeOperators: 3, adoptionRate: 0.75 })
    expect(body.signals).toEqual({ dashboardOpens: 2, firstUsefulActions: 2, medianTimeToFirstUsefulActionMs: 30_000 })
    expect(body.incidents).toEqual([{ severity: 'HIGH', status: 'OPEN', count: 2 }])
    expect(body.enrollment.pilotStartsAt).toBe('2026-09-01T00:00:00.000Z')
  })

  it('counts a personal workspace as one member and handles no data', async () => {
    asRole('OWNER', null)
    db.pilotEnrollment.findUnique.mockResolvedValue(null)
    db.pilotEvent.findMany.mockResolvedValue([])
    db.pilotIncident.groupBy.mockResolvedValue([])
    const res = await call(metrics, 'GET')
    const body = res._getJSONData()
    expect(db.teamMember.count).not.toHaveBeenCalled()
    expect(body.members).toBe(1)
    expect(body.enrollment).toBeNull()
    expect(body.signals.medianTimeToFirstUsefulActionMs).toBeNull()
    expect(db.pilotEvent.findMany.mock.calls[0][0].where.scopeKey).toBe('owner:owner')
  })
})
