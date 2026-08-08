import { createMocks } from 'node-mocks-http'

jest.mock('../../../lib/auth', () => ({
  getServerSession: jest.fn(async () => ({ user: { id: 'smoke-user', email: 'smoke@example.com', name: 'Smoke User', role: 'OWNER' } })),
  authOptions: {},
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    apiKey: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    apiRateLimit: { upsert: jest.fn(async () => ({ count: 1 })), deleteMany: jest.fn(async () => ({ count: 0 })) },
    team: { findMany: jest.fn(async () => []) },
  },
}))

import settingsHandler from '../../../pages/api/settings/api-keys'
import meHandler from '../../../pages/api/v1/me'
import { prisma } from '../../../lib/prisma'

describe('disposable public API key integration smoke', () => {
  it('creates a one-time key and immediately authenticates it against its stored hash', async () => {
    let storedHash = ''
    ;(prisma.apiKey.create as jest.Mock).mockImplementation(async ({ data }: any) => {
      storedHash = data.key
      return { id: 'disposable-key', name: data.name, createdAt: new Date('2026-08-08T12:00:00Z') }
    })
    ;(prisma.apiKey.findUnique as jest.Mock).mockImplementation(async ({ where }: any) =>
      where.key === storedHash
        ? {
            id: 'disposable-key', userId: 'smoke-user', key: storedHash, scopes: 'read', revokedAt: null,
            user: { id: 'smoke-user', email: 'smoke@example.com', name: 'Smoke User' },
          }
        : null
    )

    const created = createMocks({
      method: 'POST',
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      body: { name: 'Disposable smoke key' },
    })
    await settingsHandler(created.req as any, created.res as any)
    expect(created.res._getStatusCode()).toBe(201)
    const plaintext = JSON.parse(created.res._getData()).apiKey.key
    expect(plaintext).toMatch(/^ff_[a-f0-9]{64}$/)
    expect(storedHash).not.toBe(plaintext)

    const me = createMocks({ method: 'GET', headers: { authorization: `Bearer ${plaintext}` } })
    await meHandler(me.req as any, me.res as any)
    expect(me.res._getStatusCode()).toBe(200)
    expect(JSON.parse(me.res._getData())).toMatchObject({
      data: { apiKeyId: 'disposable-key', caller: { id: 'smoke-user' }, scopes: ['read'], workspace: { id: null, ownerId: 'smoke-user' } },
    })
    expect(me.res._getData()).not.toContain(plaintext)
  })
})
