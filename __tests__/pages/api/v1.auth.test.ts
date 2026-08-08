import { createMocks } from 'node-mocks-http'

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    apiKey: { findUnique: jest.fn(), update: jest.fn() },
    apiRateLimit: { upsert: jest.fn(), deleteMany: jest.fn() },
    team: { findMany: jest.fn() },
  },
}))

import { requireApiKey } from '../../../lib/apiAuth'
import { prisma } from '../../../lib/prisma'
import { hashToken } from '../../../lib/tokens'

const plaintext = `ff_${'a'.repeat(64)}`
const stored = {
  id: 'key-1', userId: 'user-1', key: hashToken(plaintext), scopes: 'read',
  revokedAt: null, user: { id: 'user-1', email: 'owner@example.com', name: 'Owner' },
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.apiKey.update as jest.Mock).mockResolvedValue({})
  ;(prisma.apiRateLimit.upsert as jest.Mock).mockResolvedValue({ count: 1 })
  ;(prisma.apiRateLimit.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })
  ;(prisma.team.findMany as jest.Mock).mockResolvedValue([])
})

describe('requireApiKey', () => {
  it.each([
    [undefined, 'API_KEY_MISSING'],
    ['Basic abc', 'API_KEY_MALFORMED'],
    ['Bearer', 'API_KEY_MALFORMED'],
    ['Bearer ff_short', 'API_KEY_MALFORMED'],
    [`Bearer ${plaintext} extra`, 'API_KEY_MALFORMED'],
  ])('rejects an invalid Authorization header without querying keys', async (authorization, code) => {
    const { req, res } = createMocks({ method: 'GET', headers: authorization ? { authorization } : {} })
    await expect(requireApiKey(req as any, res as any, 'read')).resolves.toBeNull()
    expect(res._getStatusCode()).toBe(401)
    expect(JSON.parse(res._getData()).error.code).toBe(code)
    expect(prisma.apiKey.findUnique).not.toHaveBeenCalled()
  })

  it('authenticates through one indexed hash lookup and resolves the owner tenant', async () => {
    ;(prisma.apiKey.findUnique as jest.Mock).mockResolvedValue(stored)
    const { req, res } = createMocks({ method: 'GET', headers: { authorization: `Bearer ${plaintext}` } })
    const context = await requireApiKey(req as any, res as any, 'read')
    expect(prisma.apiKey.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: hashToken(plaintext) },
    }))
    expect(context).toMatchObject({ apiKeyId: 'key-1', user: { id: 'user-1' }, scopes: ['read'], tenant: { ownerId: 'user-1', teamId: null }, apiResourceWhere: { ownerId: 'user-1', teamId: null } })
    expect(res._getStatusCode()).toBe(200)
  })

  it('rejects unknown and revoked keys without exposing which condition occurred', async () => {
    for (const record of [null, { ...stored, revokedAt: new Date() }]) {
      ;(prisma.apiKey.findUnique as jest.Mock).mockResolvedValueOnce(record)
      const { req, res } = createMocks({ method: 'GET', headers: { authorization: `Bearer ${plaintext}` } })
      expect(await requireApiKey(req as any, res as any, 'read')).toBeNull()
      expect(res._getStatusCode()).toBe(401)
      expect(JSON.parse(res._getData()).error.code).toBe('API_KEY_INVALID')
    }
  })

  it('returns a sanitized error envelope when key lookup fails', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    ;(prisma.apiKey.findUnique as jest.Mock).mockRejectedValue(new Error(`lookup failed for ${plaintext}`))
    const { req, res } = createMocks({ method: 'GET', headers: { authorization: `Bearer ${plaintext}` } })
    expect(await requireApiKey(req as any, res as any, 'read')).toBeNull()
    expect(res._getStatusCode()).toBe(500)
    expect(JSON.parse(res._getData())).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Authentication could not be completed' } })
    expect(JSON.stringify(spy.mock.calls)).not.toContain(plaintext)
    spy.mockRestore()
  })

  it('denies a key missing the requested scope', async () => {
    ;(prisma.apiKey.findUnique as jest.Mock).mockResolvedValue({ ...stored, scopes: 'profile' })
    const { req, res } = createMocks({ method: 'GET', headers: { authorization: `Bearer ${plaintext}` } })
    expect(await requireApiKey(req as any, res as any, 'read')).toBeNull()
    expect(res._getStatusCode()).toBe(403)
    expect(JSON.parse(res._getData()).error.code).toBe('INSUFFICIENT_SCOPE')
  })

  it('keeps historical empty-scope keys inert', async () => {
    ;(prisma.apiKey.findUnique as jest.Mock).mockResolvedValue({ ...stored, scopes: '' })
    const { req, res } = createMocks({ method: 'GET', headers: { authorization: `Bearer ${plaintext}` } })
    expect(await requireApiKey(req as any, res as any, 'read')).toBeNull()
    expect(res._getStatusCode()).toBe(403)
    expect(prisma.apiRateLimit.upsert).not.toHaveBeenCalled()
  })

  it('rate limits by API key using the public error envelope', async () => {
    ;(prisma.apiKey.findUnique as jest.Mock).mockResolvedValue(stored)
    ;(prisma.apiRateLimit.upsert as jest.Mock).mockResolvedValue({ count: 101 })
    const { req, res } = createMocks({ method: 'GET', headers: { authorization: `Bearer ${plaintext}` } })
    expect(await requireApiKey(req as any, res as any, 'read')).toBeNull()
    expect(prisma.apiRateLimit.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { keyId_bucketStart: expect.objectContaining({ keyId: 'key-1' }) },
      update: { count: { increment: 1 } },
    }))
    expect(res._getStatusCode()).toBe(429)
    expect(Number(res.getHeader('Retry-After'))).toBeGreaterThan(0)
    expect(JSON.parse(res._getData()).error.code).toBe('RATE_LIMITED')
  })

  it('fails closed with 503 when durable quota storage is unavailable', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    ;(prisma.apiKey.findUnique as jest.Mock).mockResolvedValue(stored)
    ;(prisma.apiRateLimit.upsert as jest.Mock).mockRejectedValue(new Error(`quota failed ${plaintext}`))
    const { req, res } = createMocks({ method: 'GET', headers: { authorization: `bearer ${plaintext}` } })
    expect(await requireApiKey(req as any, res as any, 'read')).toBeNull()
    expect(res._getStatusCode()).toBe(503)
    expect(JSON.parse(res._getData()).error.code).toBe('RATE_LIMIT_UNAVAILABLE')
    expect(JSON.stringify(spy.mock.calls)).not.toContain(plaintext)
    spy.mockRestore()
  })

  it('requires x-team-id when the key owner has multiple workspaces', async () => {
    ;(prisma.apiKey.findUnique as jest.Mock).mockResolvedValue(stored)
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([
      { id: 'team-a', ownerId: 'user-1', members: [] },
      { id: 'team-b', ownerId: 'user-1', members: [] },
    ])
    const { req, res } = createMocks({ method: 'GET', headers: { authorization: `Bearer ${plaintext}` } })
    expect(await requireApiKey(req as any, res as any, 'read')).toBeNull()
    expect(res._getStatusCode()).toBe(409)
    expect(JSON.parse(res._getData()).error.code).toBe('TENANT_SELECTION_REQUIRED')
  })

  it('denies a cross-tenant x-team-id and accepts an owned workspace', async () => {
    ;(prisma.apiKey.findUnique as jest.Mock).mockResolvedValue(stored)
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([{ id: 'team-a', ownerId: 'user-1', members: [] }])

    const denied = createMocks({ method: 'GET', headers: { authorization: `Bearer ${plaintext}`, 'x-team-id': 'team-b' } })
    expect(await requireApiKey(denied.req as any, denied.res as any, 'read')).toBeNull()
    expect(denied.res._getStatusCode()).toBe(403)

    const allowed = createMocks({ method: 'GET', headers: { authorization: `Bearer ${plaintext}`, 'x-team-id': 'team-a' } })
    expect(await requireApiKey(allowed.req as any, allowed.res as any, 'read')).toMatchObject({ tenant: { teamId: 'team-a' }, apiResourceWhere: { teamId: 'team-a' } })
  })

  it('gives an accepted member only the selected team rows, never owner legacy rows', async () => {
    ;(prisma.apiKey.findUnique as jest.Mock).mockResolvedValue({ ...stored, userId: 'member-1', user: { id: 'member-1', email: 'm@example.com', name: 'Member' } })
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([{ id: 'team-a', ownerId: 'owner-1', members: [{ role: 'VIEWER' }] }])
    const { req, res } = createMocks({ method: 'GET', headers: { authorization: `Bearer ${plaintext}`, 'x-team-id': 'team-a' } })
    expect(await requireApiKey(req as any, res as any, 'read')).toMatchObject({
      apiResourceWhere: { teamId: 'team-a' },
      tenant: { ownerId: 'owner-1', teamId: 'team-a', role: 'VIEWER' },
    })
  })

  it('does not fail authentication when the last-used timestamp update fails', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    ;(prisma.apiKey.findUnique as jest.Mock).mockResolvedValue(stored)
    ;(prisma.apiKey.update as jest.Mock).mockRejectedValue(new Error(`database failed for ${plaintext}`))
    const { req, res } = createMocks({ method: 'GET', headers: { authorization: `Bearer ${plaintext}` } })
    expect(await requireApiKey(req as any, res as any, 'read')).not.toBeNull()
    await new Promise(setImmediate)
    expect(spy).toHaveBeenCalledWith('API key last-used update failed')
    expect(JSON.stringify(spy.mock.calls)).not.toContain(plaintext)
    spy.mockRestore()
  })
})
