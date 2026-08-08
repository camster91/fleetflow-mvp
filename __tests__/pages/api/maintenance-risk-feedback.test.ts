import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/apiAuth', () => ({ requireTenantContext: jest.fn(), assertSameOrigin: jest.fn(() => true) }))
jest.mock('@/lib/apiRateLimit', () => ({ consumePublicApiQuota: jest.fn(async () => ({ allowed: true, remaining: 19, retryAfter: 3600 })) }))
jest.mock('@/lib/prisma', () => ({ prisma: { vehicle: { findFirst: jest.fn() }, maintenanceTask: { findMany: jest.fn() }, maintenanceRiskFeedback: { findUnique: jest.fn(), findFirst: jest.fn() }, $transaction: jest.fn() } }))

import handler, { feedbackRequestHash } from '@/pages/api/intelligence/maintenance-risk-feedback'
import { assertSameOrigin, requireTenantContext } from '@/lib/apiAuth'
import { consumePublicApiQuota } from '@/lib/apiRateLimit'
import { prisma } from '@/lib/prisma'

const scope = { OR: [{ teamId: 'team-1' }, { ownerId: 'owner-1', teamId: null }] }
const context = { session: { user: { id: 'member-1', name: 'Pilot User', role: 'MEMBER' } }, tenant: { ownerId: 'owner-1', teamId: 'team-1', role: 'MEMBER', resourceWhere: scope } }

describe('POST /api/intelligence/maintenance-risk-feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(requireTenantContext as jest.Mock).mockResolvedValue(context)
    ;(assertSameOrigin as jest.Mock).mockReturnValue(true)
    ;(consumePublicApiQuota as jest.Mock).mockResolvedValue({ allowed: true, remaining: 19, retryAfter: 3600 })
    ;(prisma.maintenanceRiskFeedback.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.vehicle.findFirst as jest.Mock).mockResolvedValue({ id: 'v1', name: 'Van', year: 2020, mileage: 50000, lastService: new Date('2026-01-01T00:00:00.000Z'), maintenanceDue: false })
    ;(prisma.maintenanceTask.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: Function) => fn({
      maintenanceRiskFeedback: { create: jest.fn().mockResolvedValue({ id: 'feedback-1', rubricVersion: 'maintenance-risk-v1', scoreSnapshot: 5, bandSnapshot: 'low', createdAt: new Date('2026-08-08T00:00:00.000Z') }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    }))
  })

  it('requires explicit research consent and bounded structured input', async () => {
    const { req, res } = createMocks({ method: 'POST', headers: { 'idempotency-key': 'pilot_request_12345678' }, body: { vehicleId: 'v1', helpful: true, actionTaken: false, consent: false } })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(400)
    expect(prisma.vehicle.findFirst).not.toHaveBeenCalled()

    const invalid = createMocks({ method: 'POST', headers: { 'idempotency-key': 'pilot_request_12345678' }, body: { vehicleId: 'v1', helpful: true, actionTaken: true, outcomeCategory: 'BREAKDOWN_PREDICTED', notes: 'x'.repeat(501), consent: true } })
    await handler(invalid.req as never, invalid.res as never)
    expect(invalid.res._getStatusCode()).toBe(400)
    const contradictory = createMocks({ method: 'POST', headers: { 'idempotency-key': 'pilot_request_12345678' }, body: { vehicleId: 'v1', helpful: true, actionTaken: false, outcomeCategory: 'SERVICE_COMPLETED', consent: true } })
    await handler(contradictory.req as never, contradictory.res as never)
    expect(contradictory.res._getStatusCode()).toBe(400)
  })

  it('recomputes the score from a canonically scoped vehicle and bounded tasks, then audits consented feedback', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'feedback-1', rubricVersion: 'maintenance-risk-v1', scoreSnapshot: 0, bandSnapshot: 'low', createdAt: new Date('2026-08-08T00:00:00.000Z') })
    const audit = jest.fn().mockResolvedValue({})
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: Function) => fn({ maintenanceRiskFeedback: { create }, auditLog: { create: audit } }))
    const { req, res } = createMocks({ method: 'POST', headers: { 'idempotency-key': 'pilot_request_12345678' }, body: { vehicleId: 'v1', helpful: true, actionTaken: true, outcomeCategory: 'SERVICE_SCHEDULED', notes: 'Booked for Monday.', consent: true } })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(201)
    expect(prisma.vehicle.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { AND: [{ id: 'v1' }, scope] }, select: expect.not.objectContaining({ ownerId: true }) }))
    expect(prisma.maintenanceTask.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { AND: [scope, { vehicleId: 'v1' }] }, take: 501 }))
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ ownerId: 'owner-1', teamId: 'team-1', vehicleId: 'v1', submittedById: 'member-1', helpful: true, actionTaken: true, outcomeCategory: 'SERVICE_SCHEDULED', rubricVersion: 'maintenance-risk-v1', sourceComplete: true, completenessPercent: expect.any(Number), idempotencyKey: 'pilot_request_12345678', requestHash: expect.stringMatching(/^[a-f0-9]{64}$/), expiresAt: expect.any(Date) }) })
    expect(audit).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'pilot_feedback_recorded', entityType: 'maintenance_risk', entityId: 'feedback-1' }) })
    expect(JSON.stringify(create.mock.calls)).not.toMatch(/probability|predicted failure/i)
  })

  it('rejects hostile/missing production origin before auth and requires idempotency before body work', async () => {
    ;(assertSameOrigin as jest.Mock).mockReturnValue(false)
    let mock = createMocks({ method: 'POST', body: {} }); await handler(mock.req as never, mock.res as never); expect(requireTenantContext).not.toHaveBeenCalled()
    ;(assertSameOrigin as jest.Mock).mockReturnValue(true)
    mock = createMocks({ method: 'POST', body: { vehicleId: 'v1', helpful: true, actionTaken: false, consent: true } }); await handler(mock.req as never, mock.res as never); expect(mock.res._getStatusCode()).toBe(400); expect(prisma.vehicle.findFirst).not.toHaveBeenCalled()
  })

  it('returns a durable replay before scoring and rate limits before vehicle reads', async () => {
    ;(prisma.maintenanceRiskFeedback.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'same', requestHash: feedbackRequestHash({ vehicleId: 'v1', helpful: true, actionTaken: false, consent: true }), rubricVersion: 'maintenance-risk-v1', scoreSnapshot: 1, bandSnapshot: 'low', createdAt: new Date() })
    let mock = createMocks({ method: 'POST', headers: { 'idempotency-key': 'pilot_request_12345678' }, body: { vehicleId: 'v1', helpful: true, actionTaken: false, consent: true } }); await handler(mock.req as never, mock.res as never); expect(mock.res._getStatusCode()).toBe(200); expect(prisma.vehicle.findFirst).not.toHaveBeenCalled(); expect(prisma.$transaction).not.toHaveBeenCalled()
    ;(prisma.maintenanceRiskFeedback.findUnique as jest.Mock).mockResolvedValue(null); (consumePublicApiQuota as jest.Mock).mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfter: 60 })
    mock = createMocks({ method: 'POST', headers: { 'idempotency-key': 'pilot_request_87654321' }, body: { vehicleId: 'v1', helpful: true, actionTaken: false, consent: true } }); await handler(mock.req as never, mock.res as never); expect(mock.res._getStatusCode()).toBe(429); expect(prisma.vehicle.findFirst).not.toHaveBeenCalled()
  })

  it('withdraws only the submitting user scoped feedback and audits the deletion', async () => {
    ;(prisma.maintenanceRiskFeedback.findFirst as jest.Mock).mockResolvedValue({ id: 'f1', vehicleId: 'v1', rubricVersion: 'maintenance-risk-v1' })
    const remove = jest.fn().mockResolvedValue({}); const audit = jest.fn().mockResolvedValue({})
    ;(prisma.$transaction as jest.Mock).mockImplementationOnce(async (fn: Function) => fn({ maintenanceRiskFeedback: { delete: remove }, auditLog: { create: audit } }))
    const { req, res } = createMocks({ method: 'DELETE', body: { id: 'f1' } })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(200)
    expect(prisma.maintenanceRiskFeedback.findFirst).toHaveBeenCalledWith({ where: { id: 'f1', submittedById: 'member-1', scopeKey: 'team:team-1', ownerId: 'owner-1', teamId: 'team-1' } })
    expect(remove).toHaveBeenCalledWith({ where: { id: 'f1' } })
    expect(audit).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'pilot_feedback_withdrawn', entityId: 'f1' }) })
  })

  it('allows a demoted viewer to withdraw only their own exact workspace feedback', async () => {
    ;(requireTenantContext as jest.Mock).mockResolvedValueOnce({ ...context, tenant: { ...context.tenant, role: 'VIEWER' } })
    ;(prisma.maintenanceRiskFeedback.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'f1', vehicleId: 'v1', rubricVersion: 'maintenance-risk-v1' })
    ;(prisma.$transaction as jest.Mock).mockImplementationOnce(async (fn: Function) => fn({ maintenanceRiskFeedback: { delete: jest.fn() }, auditLog: { create: jest.fn() } }))
    const mock = createMocks({ method: 'DELETE', body: { id: 'f1' } }); await handler(mock.req as never, mock.res as never); expect(mock.res._getStatusCode()).toBe(200)
    expect(prisma.maintenanceRiskFeedback.findFirst).toHaveBeenCalledWith({ where: { id: 'f1', submittedById: 'member-1', scopeKey: 'team:team-1', ownerId: 'owner-1', teamId: 'team-1' } })
  })

  it('returns 409 when the same idempotency key is reused with altered feedback', async () => {
    ;(prisma.maintenanceRiskFeedback.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'same', requestHash: 'different', rubricVersion: 'maintenance-risk-v1', scoreSnapshot: 1, bandSnapshot: 'low', createdAt: new Date() })
    const mock = createMocks({ method: 'POST', headers: { 'idempotency-key': 'pilot_request_12345678' }, body: { vehicleId: 'changed', helpful: false, actionTaken: false, consent: true } }); await handler(mock.req as never, mock.res as never)
    expect(mock.res._getStatusCode()).toBe(409); expect(prisma.vehicle.findFirst).not.toHaveBeenCalled(); expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects cross-tenant vehicles, viewers, unsupported methods, and missing auth', async () => {
    ;(prisma.vehicle.findFirst as jest.Mock).mockResolvedValueOnce(null)
    let mock = createMocks({ method: 'POST', headers: { 'idempotency-key': 'pilot_request_outside' }, body: { vehicleId: 'outside', helpful: false, actionTaken: false, consent: true } })
    await handler(mock.req as never, mock.res as never)
    expect(mock.res._getStatusCode()).toBe(404)
    ;(requireTenantContext as jest.Mock).mockResolvedValueOnce({ ...context, tenant: { ...context.tenant, role: 'VIEWER' } })
    mock = createMocks({ method: 'POST', headers: { 'idempotency-key': 'pilot_request_viewer' }, body: { vehicleId: 'v1', helpful: false, actionTaken: false, consent: true } })
    await handler(mock.req as never, mock.res as never)
    expect(mock.res._getStatusCode()).toBe(403)
    mock = createMocks({ method: 'GET' }); await handler(mock.req as never, mock.res as never); expect(mock.res._getStatusCode()).toBe(405)
    ;(prisma.vehicle.findFirst as jest.Mock).mockClear()
    ;(requireTenantContext as jest.Mock).mockResolvedValueOnce(null)
    mock = createMocks({ method: 'POST', body: {} }); await handler(mock.req as never, mock.res as never); expect(prisma.vehicle.findFirst).not.toHaveBeenCalled()
  })
})
