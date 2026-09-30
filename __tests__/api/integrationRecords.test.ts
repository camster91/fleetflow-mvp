import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/integrations/runtime', () => ({ requireIntegrationAdmin: jest.fn() }))
jest.mock('@/lib/integrations/rateLimit', () => ({ enforceIntegrationRateLimit: jest.fn().mockResolvedValue(true) }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    integrationRecord: { findMany: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn() },
    integrationRecordReview: { create: jest.fn() },
    vehicle: { findMany: jest.fn(), findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import handler from '@/pages/api/integrations/records'
import { requireIntegrationAdmin } from '@/lib/integrations/runtime'
import { prisma } from '@/lib/prisma'

const db = prisma as unknown as {
  integrationRecord: Record<string, jest.Mock>
  integrationRecordReview: { create: jest.Mock }
  vehicle: Record<string, jest.Mock>
  auditLog: { create: jest.Mock }
  $transaction: jest.Mock
}
const hash = 'a'.repeat(64)
const context = {
  session: { user: { id: 'u1', name: 'Owner', email: 'owner@example.test' } },
  tenant: { role: 'OWNER', teamId: 'team-1', resourceWhere: { teamId: 'team-1' } },
  scopeKey: 'team:team-1',
}
const record = {
  id: 'r1',
  revision: 2,
  payloadHash: hash,
  reviewStatus: 'PENDING_REVIEW',
  reviewPayload: '{"amount":10}',
  localEntityId: null,
  remoteType: 'purchase',
  connection: { provider: 'quickbooks' },
}

async function call(method: string, body?: unknown) {
  const { req, res } = createMocks({ method: method as never, body: body as never })
  await handler(req as never, res as never)
  return res
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(requireIntegrationAdmin as jest.Mock).mockResolvedValue(context)
  db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma))
  db.integrationRecord.findFirst.mockResolvedValue(record)
  db.integrationRecord.updateMany.mockResolvedValue({ count: 1 })
  db.integrationRecord.findUnique.mockResolvedValue({ id: 'r1', reviewStatus: 'REJECTED', revision: 2 })
})

describe('/api/integrations/records', () => {
  it('rejects other methods', async () => {
    expect((await call('DELETE'))._getStatusCode()).toBe(405)
  })

  it('stops when the caller cannot manage integrations', async () => {
    ;(requireIntegrationAdmin as jest.Mock).mockResolvedValue(null)
    await call('GET')
    expect(db.integrationRecord.findMany).not.toHaveBeenCalled()
  })

  it('lists staged records for this workspace only and tolerates bad JSON', async () => {
    db.integrationRecord.findMany.mockResolvedValue([
      { id: 'r1', reviewPayload: '{"amount":10}', provenance: 'not json', connection: { provider: 'quickbooks' } },
    ])
    db.vehicle.findMany.mockResolvedValue([{ id: 'v1', name: 'Truck' }])
    const res = await call('GET')
    expect(res._getStatusCode()).toBe(200)
    expect(db.integrationRecord.findMany.mock.calls[0][0].where.connection).toEqual({ scopeKey: 'team:team-1' })
    expect(db.vehicle.findMany.mock.calls[0][0].where).toBe(context.tenant.resourceWhere)
    expect(res._getJSONData().records[0]).toMatchObject({ payload: { amount: 10 }, provenance: null })
  })

  it('rejects malformed review requests', async () => {
    const res = await call('PATCH', { recordId: 'r1', revision: 2, payloadHash: 'short', action: 'APPROVE' })
    expect(res._getStatusCode()).toBe(400)
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('returns 404 for a record outside this workspace', async () => {
    db.integrationRecord.findFirst.mockResolvedValue(null)
    const res = await call('PATCH', { recordId: 'r9', revision: 2, payloadHash: hash, action: 'REJECT' })
    expect(res._getStatusCode()).toBe(404)
    expect(db.integrationRecord.findFirst.mock.calls[0][0].where.connection).toEqual({ scopeKey: 'team:team-1' })
  })

  it('returns 409 when the record changed since it was loaded', async () => {
    const res = await call('PATCH', { recordId: 'r1', revision: 1, payloadHash: hash, action: 'REJECT' })
    expect(res._getStatusCode()).toBe(409)
    expect(db.integrationRecord.updateMany).not.toHaveBeenCalled()
  })

  it('refuses to map to a vehicle from another workspace', async () => {
    db.vehicle.findFirst.mockResolvedValue(null)
    const res = await call('PATCH', {
      recordId: 'r1',
      revision: 2,
      payloadHash: hash,
      action: 'MAP',
      vehicleId: 'v-other',
    })
    expect(res._getStatusCode()).toBe(404)
    expect(db.integrationRecord.updateMany).not.toHaveBeenCalled()
  })

  it('refuses an invalid transition', async () => {
    const res = await call('PATCH', { recordId: 'r1', revision: 2, payloadHash: hash, action: 'APPROVE' })
    expect(res._getStatusCode()).toBe(409)
  })

  it('records a rejection with a review row and an audit entry', async () => {
    const res = await call('PATCH', { recordId: 'r1', revision: 2, payloadHash: hash, action: 'REJECT' })
    expect(res._getStatusCode()).toBe(200)
    expect(db.integrationRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reviewStatus: 'REJECTED' }) })
    )
    expect(db.integrationRecordReview.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ recordId: 'r1', decision: 'REJECT', reviewerId: 'u1' }),
    })
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'integration_record_reject', teamId: 'team-1' }),
    })
  })

  it('maps a duplicate review decision to 409', async () => {
    db.integrationRecordReview.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))
    const res = await call('PATCH', { recordId: 'r1', revision: 2, payloadHash: hash, action: 'REJECT' })
    expect(res._getStatusCode()).toBe(409)
  })
})
