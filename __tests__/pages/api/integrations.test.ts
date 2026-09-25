import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn().mockResolvedValue([{ count: 1 }]),
    $transaction: jest.fn(),
    integrationConnection: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    integrationOAuthState: { create: jest.fn(), deleteMany: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
    integrationSyncJob: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    integrationRecord: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    delivery: { findMany: jest.fn(), updateMany: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}))
jest.mock('@/lib/apiAuth', () => ({
  requireTenantContext: jest.fn(async () => ({
    session: { user: { id: 'admin' } },
    tenant: { ownerId: 'owner-a', teamId: 'team-a', role: 'OWNER', resourceWhere: { teamId: 'team-a' } },
  })),
  assertSameOrigin: jest.fn(() => true),
}))

import connectHandler from '@/pages/api/integrations/[provider]/connect'
import syncHandler from '@/pages/api/integrations/[provider]/sync'
import { prisma } from '@/lib/prisma'
import { decryptCredentialEnvelope, encryptCredentialEnvelope } from '@/lib/integrations/oauth'

const mockPrisma = prisma as unknown as {
  $queryRaw: jest.Mock
  $transaction: jest.Mock
  integrationConnection: Record<string, jest.Mock>
  integrationOAuthState: Record<string, jest.Mock>
  integrationSyncJob: Record<string, jest.Mock>
  integrationRecord: Record<string, jest.Mock>
  delivery: Record<string, jest.Mock>
  auditLog: Record<string, jest.Mock>
}

describe('provider integration APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.GOOGLE_MAPS_SERVER_API_KEY = 'server-key'
    process.env.GOOGLE_MAPS_BASE_URL = 'https://maps.googleapis.com'
    process.env.INTEGRATION_ENCRYPTION_KEYS = `qa:${Buffer.alloc(32, 6).toString('base64')}`
    process.env.QUICKBOOKS_CLIENT_ID = 'client'
    process.env.QUICKBOOKS_CLIENT_SECRET = 'secret'
    process.env.QUICKBOOKS_REDIRECT_URI = 'https://fleetvera.test/api/integrations/quickbooks/callback'
    process.env.QUICKBOOKS_API_BASE_URL = 'https://quickbooks.api.intuit.com'
    mockPrisma.integrationConnection.upsert.mockResolvedValue({
      id: 'connection-a',
      provider: 'google-maps',
      generation: 1,
    })
    mockPrisma.auditLog.create.mockResolvedValue({})
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(mockPrisma))
  })

  it('connects Google Maps as a verified service without inventing OAuth', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      query: { provider: 'google-maps' },
      headers: { host: 'fleetvera.test', origin: 'https://fleetvera.test' },
    })
    await connectHandler(req as any, res as any)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res._getData())).toEqual({ connected: true })
    expect(mockPrisma.integrationOAuthState.create).not.toHaveBeenCalled()
    expect(mockPrisma.integrationConnection.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          ownerId: 'owner-a',
          teamId: 'team-a',
          scopeKey: 'team:team-a',
          status: 'CONNECTED',
        }),
      })
    )
  })

  it('rejects sync without a durable idempotency marker before provider I/O', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      query: { provider: 'google-maps' },
      headers: { host: 'fleetvera.test', origin: 'https://fleetvera.test' },
    })
    await syncHandler(req as any, res as any)
    expect(res.statusCode).toBe(400)
    expect(mockPrisma.integrationConnection.findUnique).not.toHaveBeenCalled()
  })

  it('does not expose unsupported provider internals', async () => {
    const { req, res } = createMocks({ method: 'POST', query: { provider: 'attacker' } })
    await connectHandler(req as any, res as any)
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res._getData())).toEqual({ error: 'Integration provider not found' })
  })

  it('replays a durable completed job instead of syncing duplicate events', async () => {
    mockPrisma.integrationConnection.findUnique.mockResolvedValue({
      id: 'connection-a',
      provider: 'google-maps',
      status: 'CONNECTED',
      syncCursor: 'cursor-a',
    })
    mockPrisma.integrationSyncJob.findUnique.mockResolvedValue({ id: 'job-a', status: 'COMPLETED' })
    const { req, res } = createMocks({
      method: 'POST',
      query: { provider: 'google-maps' },
      headers: { host: 'fleetvera.test', origin: 'https://fleetvera.test', 'idempotency-key': 'request_12345678' },
    })
    await syncHandler(req as any, res as any)
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res._getData())).toEqual({ job: { id: 'job-a', status: 'COMPLETED' }, replayed: true })
    expect(mockPrisma.integrationConnection.updateMany).not.toHaveBeenCalled()
  })

  it('rejects a sync race when the durable lease is already held', async () => {
    mockPrisma.integrationConnection.findUnique.mockResolvedValue({
      id: 'connection-a',
      provider: 'google-maps',
      status: 'CONNECTED',
      syncCursor: null,
    })
    mockPrisma.integrationSyncJob.findUnique.mockResolvedValue(null)
    mockPrisma.integrationConnection.updateMany.mockResolvedValue({ count: 0 })
    const { req, res } = createMocks({
      method: 'POST',
      query: { provider: 'google-maps' },
      headers: { host: 'fleetvera.test', origin: 'https://fleetvera.test', 'idempotency-key': 'request_87654321' },
    })
    await syncHandler(req as any, res as any)
    expect(res.statusCode).toBe(409)
    expect(mockPrisma.integrationSyncJob.create).not.toHaveBeenCalled()
  })

  it('disconnects idempotently and removes local credential metadata', async () => {
    mockPrisma.integrationConnection.findUnique.mockResolvedValue({
      id: 'connection-a',
      provider: 'google-maps',
      credentialEnvelope: null,
      generation: 2,
      status: 'CONNECTED',
      revokedAt: null,
    })
    mockPrisma.integrationConnection.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.integrationSyncJob.updateMany.mockResolvedValue({ count: 0 })
    mockPrisma.integrationOAuthState.deleteMany.mockResolvedValue({ count: 0 })
    const { req, res } = createMocks({
      method: 'DELETE',
      query: { provider: 'google-maps' },
      headers: { host: 'fleetvera.test', origin: 'https://fleetvera.test' },
    })
    await connectHandler(req as any, res as any)
    expect(res.statusCode).toBe(200)
    expect(mockPrisma.integrationConnection.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ generation: 2 }),
        data: expect.objectContaining({
          generation: { increment: 1 },
          credentialEnvelope: null,
          externalAccountRef: null,
          status: 'DISCONNECTED',
          lockToken: null,
        }),
      })
    )
    expect(mockPrisma.integrationOAuthState.deleteMany).toHaveBeenCalledWith({
      where: { connectionId: 'connection-a', generation: 2 },
    })
  })

  it('rotates a QuickBooks refresh token and stages a bounded partial batch', async () => {
    const originalFetch = global.fetch
    const envelope = encryptCredentialEnvelope(
      { accessToken: 'expired', refreshToken: 'old-refresh', realmId: 'realm-a' },
      'team:team-a',
      'quickbooks'
    )
    mockPrisma.integrationConnection.findUnique.mockResolvedValue({
      id: 'connection-qb',
      provider: 'quickbooks',
      status: 'CONNECTED',
      revokedAt: null,
      generation: 1,
      scopeKey: 'team:team-a',
      credentialEnvelope: envelope,
      tokenExpiresAt: new Date(0),
      refreshTokenExpiresAt: new Date(Date.now() + 60_000),
      syncCursor: null,
    })
    mockPrisma.integrationSyncJob.findUnique.mockResolvedValue(null)
    mockPrisma.integrationConnection.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.integrationSyncJob.create.mockResolvedValue({ id: 'job-qb', attemptCount: 1 })
    mockPrisma.integrationSyncJob.update.mockResolvedValue({ id: 'job-qb', status: 'COMPLETED' })
    mockPrisma.integrationSyncJob.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.integrationRecord.findUnique.mockResolvedValue(null)
    mockPrisma.integrationRecord.create.mockResolvedValue({ id: 'record-qb' })
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'new-access',
            refresh_token: 'new-refresh',
            expires_in: 3600,
            x_refresh_token_expires_in: 7200,
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            QueryResponse: {
              Purchase: [{ Id: 'purchase-1', TxnDate: '2026-08-08', TotalAmt: 50, EntityRef: { value: 'vendor-1' } }],
            },
          }),
          { status: 200 }
        )
      ) as jest.Mock
    try {
      const { req, res } = createMocks({
        method: 'POST',
        query: { provider: 'quickbooks' },
        headers: { host: 'fleetvera.test', origin: 'https://fleetvera.test', 'idempotency-key': 'request_qb_12345' },
      })
      await syncHandler(req as any, res as any)
      expect(res.statusCode).toBe(200)
      const rotation = mockPrisma.integrationConnection.updateMany.mock.calls.find(
        ([arg]) => arg.data.credentialEnvelope
      )?.[0].data
      expect(decryptCredentialEnvelope(rotation.credentialEnvelope, 'team:team-a', 'quickbooks')).toEqual({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        realmId: 'realm-a',
      })
      expect(mockPrisma.integrationRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ remoteId: 'purchase-1', reviewStatus: 'PENDING_REVIEW' }),
        })
      )
    } finally {
      global.fetch = originalFetch
    }
  })

  it('marks expired invalid_grant credentials reconnect-required and clears them', async () => {
    const originalFetch = global.fetch
    const envelope = encryptCredentialEnvelope(
      { accessToken: 'expired', refreshToken: 'invalid', realmId: 'realm-a' },
      'team:team-a',
      'quickbooks'
    )
    mockPrisma.integrationConnection.findUnique.mockResolvedValue({
      id: 'connection-qb',
      provider: 'quickbooks',
      status: 'CONNECTED',
      revokedAt: null,
      generation: 1,
      scopeKey: 'team:team-a',
      credentialEnvelope: envelope,
      tokenExpiresAt: new Date(0),
      refreshTokenExpiresAt: new Date(Date.now() + 60_000),
      syncCursor: null,
    })
    mockPrisma.integrationSyncJob.findUnique.mockResolvedValue(null)
    mockPrisma.integrationConnection.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.integrationSyncJob.create.mockResolvedValue({ id: 'job-qb', attemptCount: 1 })
    mockPrisma.integrationSyncJob.update.mockResolvedValue({})
    mockPrisma.integrationSyncJob.updateMany.mockResolvedValue({ count: 1 })
    global.fetch = jest.fn().mockResolvedValue(new Response('{"error":"invalid_grant"}', { status: 400 })) as jest.Mock
    try {
      const { req, res } = createMocks({
        method: 'POST',
        query: { provider: 'quickbooks' },
        headers: { host: 'fleetvera.test', origin: 'https://fleetvera.test', 'idempotency-key': 'request_qb_54321' },
      })
      await syncHandler(req as any, res as any)
      expect(res.statusCode).toBe(409)
      expect(mockPrisma.integrationConnection.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'connection-qb', generation: 1 }),
          data: expect.objectContaining({
            status: 'RECONNECT_REQUIRED',
            credentialEnvelope: null,
            lastErrorCode: 'OAUTH_RECONNECT_REQUIRED',
          }),
        })
      )
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'integration_sync_failed',
            metadata: expect.stringContaining('OAUTH_RECONNECT_REQUIRED'),
          }),
        })
      )
    } finally {
      global.fetch = originalFetch
    }
  })
})
