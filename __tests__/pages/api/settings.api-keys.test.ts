import { createMocks } from 'node-mocks-http'

jest.mock('../../../lib/auth', () => ({
  getServerSession: jest.fn(),
  authOptions: {},
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    apiKey: {
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    team: { findMany: jest.fn() },
  },
}))

jest.mock('../../../lib/tokens', () => ({
  generateAPIKey: () => ({ key: 'ff_plaintext_once', hashedKey: 'hashed-value' }),
  hashToken: (t: string) => `hash(${t})`,
  constantTimeCompare: (a: string, b: string) => a === b,
}))

import handler from '../../../pages/api/settings/api-keys'
import { getServerSession } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.team.findMany as jest.Mock).mockResolvedValue([])
})

const memberSession = { user: { id: 'u1', email: 'u@x.com', name: 'U', role: 'user' } }
const teamWithRole = (role: string) => [{ id: 'team-1', ownerId: 'owner-1', members: [{ role }] }]

describe('/api/settings/api-keys', () => {
  it('stores hashed key and returns plaintext only on create', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'u1', email: 'u@x.com', name: 'U', role: 'user' },
    })
    ;(prisma.apiKey.create as jest.Mock).mockResolvedValue({
      id: 'k1',
      name: 'CI',
      createdAt: new Date(),
    })

    const { req, res } = createMocks({
      method: 'POST',
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      body: { name: 'CI' },
    })

    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(201)
    expect(prisma.apiKey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ key: 'hashed-value' }),
      })
    )
    const body = JSON.parse(res._getData())
    expect(body.apiKey.key).toBe('ff_plaintext_once')
    expect(body.apiKey.scopes).toEqual(['read'])
    expect(prisma.apiKey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ scopes: 'read' }),
      })
    )
  })

  it('never returns stored key material on list', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'u1', email: 'u@x.com', name: 'U', role: 'user' },
    })
    ;(prisma.apiKey.findMany as jest.Mock).mockResolvedValue([
      { id: 'k1', name: 'CI', key: 'hashed-value', scopes: 'read', createdAt: new Date(), lastUsedAt: null },
    ])

    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as any, res as any)
    const body = JSON.parse(res._getData())
    expect(body.keys[0].key).toMatch(/•/)
    expect(body.keys[0].key).not.toContain('hashed-value')
    expect(body.keys[0].scopes).toEqual(['read'])
  })

  it.each(['DISPATCHER', 'TECHNICIAN', 'DRIVER', 'MEMBER', 'VIEWER'])(
    'denies %s creating or listing API keys',
    async (role) => {
      ;(getServerSession as jest.Mock).mockResolvedValue(memberSession)
      ;(prisma.team.findMany as jest.Mock).mockResolvedValue(teamWithRole(role))

      const create = createMocks({
        method: 'POST',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
        body: { name: 'CI' },
      })
      await handler(create.req as any, create.res as any)
      expect(create.res._getStatusCode()).toBe(403)
      expect(prisma.apiKey.create).not.toHaveBeenCalled()

      const list = createMocks({ method: 'GET' })
      await handler(list.req as any, list.res as any)
      expect(list.res._getStatusCode()).toBe(403)
      expect(prisma.apiKey.findMany).not.toHaveBeenCalled()
    }
  )

  it.each(['ADMIN', 'MANAGER'])('allows %s team members to create API keys', async (role) => {
    ;(getServerSession as jest.Mock).mockResolvedValue(memberSession)
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue(teamWithRole(role))
    ;(prisma.apiKey.create as jest.Mock).mockResolvedValue({ id: 'k1', name: 'CI', createdAt: new Date() })
    const { req, res } = createMocks({
      method: 'POST',
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      body: { name: 'CI' },
    })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(201)
  })

  it('still lets a downgraded user revoke their own key', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(memberSession)
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue(teamWithRole('VIEWER'))
    ;(prisma.apiKey.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    const { req, res } = createMocks({
      method: 'DELETE',
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      query: { id: 'k1' },
    })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(200)
    expect(prisma.apiKey.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'k1', userId: 'u1' },
      })
    )
  })
})
