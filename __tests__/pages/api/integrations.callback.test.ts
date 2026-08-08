import { createMocks } from 'node-mocks-http'
import { hashOAuthState } from '@/lib/integrations/oauth'

jest.mock('@/lib/prisma', () => ({ prisma: {
  $queryRaw: jest.fn().mockResolvedValue([{ count: 1 }]),
  $transaction: jest.fn(async (callback) => callback((require('@/lib/prisma') as any).prisma)),
  integrationOAuthState: { findUnique: jest.fn(), updateMany: jest.fn() },
  integrationConnection: { updateMany: jest.fn() },
  auditLog: { create: jest.fn() },
} }))
jest.mock('@/lib/apiAuth', () => ({
  requireTenantContext: jest.fn(async () => ({ session: { user: { id: 'admin', email: 'admin@test.invalid', name: 'Admin' } }, tenant: { ownerId: 'owner-a', teamId: 'team-a', role: 'OWNER', resourceWhere: { teamId: 'team-a' } } })),
  assertSameOrigin: jest.fn(() => true),
}))

import handler from '@/pages/api/integrations/[provider]/callback'
import { prisma } from '@/lib/prisma'

const mockPrisma = prisma as unknown as { integrationOAuthState: Record<string, jest.Mock>; integrationConnection: Record<string, jest.Mock>; auditLog: Record<string, jest.Mock> }
const state = 's'.repeat(43)
const active = () => ({ id: 'state-a', connectionId: 'connection-a', generation: 2, stateDigest: hashOAuthState(state), consumedAt: null, expiresAt: new Date(Date.now() + 60_000), connection: { scopeKey: 'team:team-a', provider: 'quickbooks', generation: 2, revokedAt: null, status: 'CONNECTING' } })

function request(query: Record<string, string> = {}) {
  return createMocks({ method: 'GET', query: { provider: 'quickbooks', code: 'code-a', state, realmId: 'realm-a', ...query } })
}

describe('QuickBooks OAuth callback lifecycle', () => {
  const originalFetch = global.fetch
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.INTEGRATION_ENCRYPTION_KEYS = `qa:${Buffer.alloc(32, 4).toString('base64')}`
    process.env.QUICKBOOKS_CLIENT_ID = 'client'
    process.env.QUICKBOOKS_CLIENT_SECRET = 'secret'
    process.env.QUICKBOOKS_REDIRECT_URI = 'https://fleetvera.test/api/integrations/quickbooks/callback'
    mockPrisma.integrationOAuthState.findUnique.mockResolvedValue(active())
    mockPrisma.integrationOAuthState.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.integrationConnection.updateMany.mockResolvedValue({ count: 1 })
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, x_refresh_token_expires_in: 7200, scope: 'com.intuit.quickbooks.accounting' }), { status: 200 })) as jest.Mock
  })
  afterAll(() => { global.fetch = originalFetch })

  it('consumes a valid state once and stores only an encrypted credential envelope', async () => {
    const { req, res } = request()
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(303)
    expect(mockPrisma.integrationOAuthState.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ consumedAt: null }) }))
    const data = mockPrisma.integrationConnection.updateMany.mock.calls[0][0].data
    expect(data.credentialEnvelope).toMatch(/^v2:qa:/)
    expect(data.credentialEnvelope).not.toContain('access')
    expect(data.status).toBe('CONNECTED')
    expect(data.refreshTokenExpiresAt).toBeInstanceOf(Date)
  })

  it.each([
    ['tampered', null],
    ['expired', { ...active(), expiresAt: new Date(Date.now() - 1) }],
    ['replayed', { ...active(), consumedAt: new Date() }],
    ['cross-tenant', { ...active(), connection: { scopeKey: 'team:other', provider: 'quickbooks' } }],
  ])('rejects %s state before token exchange', async (_label, value) => {
    mockPrisma.integrationOAuthState.findUnique.mockResolvedValue(value)
    const { req, res } = request()
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(303)
    expect(res._getRedirectUrl()).toContain('status=oauth_invalid')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('rejects a concurrent replay when atomic state consumption loses', async () => {
    mockPrisma.integrationOAuthState.updateMany.mockResolvedValue({ count: 0 })
    const { req, res } = request()
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(303)
    expect(res._getRedirectUrl()).toContain('status=connection_changed')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('classifies invalid_grant as reconnect-required and clears unusable credentials', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('{"error":"invalid_grant"}', { status: 400 })) as jest.Mock
    const { req, res } = request()
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(303)
    expect(res._getRedirectUrl()).toContain('status=oauth_failed')
    expect(mockPrisma.integrationConnection.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'connection-a', generation: 2 }), data: expect.objectContaining({ status: 'RECONNECT_REQUIRED', credentialEnvelope: null, lastErrorCode: 'OAUTH_RECONNECT_REQUIRED' }) }))
  })

  it('does not restore credentials when disconnect changes the generation during token exchange', async () => {
    mockPrisma.integrationConnection.updateMany.mockResolvedValueOnce({ count: 0 })
    const { req, res } = request()
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(303)
    expect(res._getRedirectUrl()).toContain('status=connection_changed')
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled()
  })
})
