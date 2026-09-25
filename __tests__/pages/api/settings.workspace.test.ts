import { createMocks } from 'node-mocks-http'

const mockTenant = { current: { ownerId: 'owner-1', teamId: 'team-1' as string | null, role: 'OWNER' } }

jest.mock('@/lib/prisma', () => ({
  prisma: {
    team: { findUnique: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
  },
}))
jest.mock('@/lib/rateLimit', () => ({ rateLimitMiddleware: jest.fn(async () => true) }))
jest.mock('@/lib/apiAuth', () => ({
  assertSameOrigin: jest.fn(() => true),
  requireTenantContext: jest.fn(async () => ({ session: { user: { id: 'user-1' } }, tenant: mockTenant.current })),
}))

import handler from '@/pages/api/settings/workspace'
import { prisma } from '@/lib/prisma'

async function call(method: string, body?: unknown) {
  const { req, res } = createMocks({ method: method as never, body: body as never })
  await handler(req as never, res as never)
  return { status: res._getStatusCode(), body: res._getJSONData() }
}

describe('/api/settings/workspace', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockTenant.current = { ownerId: 'owner-1', teamId: 'team-1', role: 'OWNER' }
  })

  it('returns the team workspace time zone and edit permission', async () => {
    ;(prisma.team.findUnique as jest.Mock).mockResolvedValue({ name: 'Fleet', timeZone: 'America/Vancouver' })
    mockTenant.current.role = 'MEMBER'
    const { status, body } = await call('GET')
    expect(status).toBe(200)
    expect(body).toEqual({ scope: 'team', name: 'Fleet', timeZone: 'America/Vancouver', canEdit: false })
  })

  it('lets an admin set a valid IANA zone on the selected team, stored in canonical form', async () => {
    mockTenant.current.role = 'ADMIN'
    ;(prisma.team.update as jest.Mock).mockResolvedValue({})
    const { status, body } = await call('PATCH', { timeZone: 'america/vancouver' })
    expect(status).toBe(200)
    expect(body).toEqual({ timeZone: 'America/Vancouver' })
    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      data: { timeZone: 'America/Vancouver' },
    })
  })

  it('stores a personal workspace zone on the owner user', async () => {
    mockTenant.current = { ownerId: 'owner-1', teamId: null, role: 'OWNER' }
    ;(prisma.user.update as jest.Mock).mockResolvedValue({})
    const { status } = await call('PATCH', { timeZone: 'UTC' })
    expect(status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'owner-1' }, data: { timeZone: 'UTC' } })
    expect(prisma.team.update).not.toHaveBeenCalled()
  })

  it.each([
    ['unknown zone', 'Mars/Olympus'],
    ['raw offset', '+05:00'],
    ['empty', ''],
    ['non-string', 42],
    ['missing', undefined],
  ])('rejects an invalid zone (%s) with 400', async (_label, timeZone) => {
    const { status } = await call('PATCH', { timeZone })
    expect(status).toBe(400)
    expect(prisma.team.update).not.toHaveBeenCalled()
  })

  it.each(['MANAGER', 'MEMBER', 'VIEWER', 'DRIVER'])('forbids %s from changing the zone', async (role) => {
    mockTenant.current.role = role
    const { status } = await call('PATCH', { timeZone: 'UTC' })
    expect(status).toBe(403)
    expect(prisma.team.update).not.toHaveBeenCalled()
  })

  it('rejects other methods', async () => {
    const { status } = await call('PUT', { timeZone: 'UTC' })
    expect(status).toBe(405)
  })
})
