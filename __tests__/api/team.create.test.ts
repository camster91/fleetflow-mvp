import { createMocks } from 'node-mocks-http'

const SAME_ORIGIN = { host: 'app.test', origin: 'http://app.test' }
const mockTx = {
  $executeRaw: jest.fn(),
  team: { count: jest.fn(), create: jest.fn() },
  auditLog: { create: jest.fn() },
}

jest.mock('@/lib/auth', () => ({ getServerSession: jest.fn(), authOptions: {} }))
jest.mock('@/lib/teamWorkspace', () => ({ movePersonalWorkspaceIntoTeam: jest.fn() }))
jest.mock('@/lib/rateLimit', () => ({ rateLimitMiddleware: jest.fn().mockResolvedValue(true) }))
jest.mock('@/lib/prisma', () => ({
  prisma: { $transaction: jest.fn((fn: (client: unknown) => unknown) => fn(mockTx)) },
}))

import handler from '@/pages/api/team/create'
import { getServerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { movePersonalWorkspaceIntoTeam } from '@/lib/teamWorkspace'

async function call(body: unknown, method = 'POST', headers: Record<string, string> = SAME_ORIGIN) {
  const { req, res } = createMocks({ method: method as never, headers, body: body as never })
  await handler(req as never, res as never)
  return res
}

describe('POST /api/team/create', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1', name: 'Pat' } })
    mockTx.team.count.mockResolvedValue(0)
    mockTx.team.create.mockResolvedValue({ id: 'team-new', name: 'Northside' })
    ;(movePersonalWorkspaceIntoTeam as jest.Mock).mockResolvedValue({ vehicle: 2 })
  })

  it('accepts only POST', async () => {
    const res = await call({}, 'GET')
    expect(res._getStatusCode()).toBe(405)
  })

  it('rejects cross-site requests before touching the session', async () => {
    const res = await call({ name: 'Northside' }, 'POST', { host: 'app.test', origin: 'https://evil.test' })
    expect(res._getStatusCode()).toBe(403)
    expect(getServerSession).not.toHaveBeenCalled()
  })

  it('requires a session', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    expect((await call({ name: 'Northside' }))._getStatusCode()).toBe(401)
  })

  it.each([[{}], [{ name: 'x' }], [{ name: 'a'.repeat(81) }], [{ name: 'Ok team', ownerId: 'someone-else' }]])(
    'rejects an invalid body %j',
    async (body) => {
      const res = await call(body)
      expect(res._getStatusCode()).toBe(400)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    }
  )

  it('creates a team owned by the caller, audits it and makes it the active workspace', async () => {
    const res = await call({ name: '  Northside  ' })
    expect(res._getStatusCode()).toBe(201)
    expect(mockTx.$executeRaw).toHaveBeenCalled()
    expect(mockTx.team.create).toHaveBeenCalledWith({
      data: { name: 'Northside', ownerId: 'u1' },
      select: { id: true, name: true },
    })
    // The personal workspace's records move into the team in the same transaction.
    expect(movePersonalWorkspaceIntoTeam).toHaveBeenCalledWith(mockTx, 'u1', 'team-new')
    expect(mockTx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        teamId: 'team-new',
        entityType: 'team',
        action: 'created',
        metadata: JSON.stringify({ movedFromPersonalWorkspace: { vehicle: 2 } }),
      }),
    })
    expect(String(res.getHeader('Set-Cookie'))).toMatch(/^fleetflow_team=team-new;.*HttpOnly/)
    expect(res._getJSONData()).toEqual({ team: { id: 'team-new', name: 'Northside' } })
  })

  it('allows one owned team during the beta', async () => {
    mockTx.team.count.mockResolvedValue(1)
    const res = await call({ name: 'Second team' })
    expect(res._getStatusCode()).toBe(409)
    expect(mockTx.team.create).not.toHaveBeenCalled()
    expect(res.getHeader('Set-Cookie')).toBeUndefined()
  })

  it('returns a JSON error and no cookie when the transaction fails', async () => {
    ;(movePersonalWorkspaceIntoTeam as jest.Mock).mockRejectedValue(new Error('db down'))
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const res = await call({ name: 'Northside' })
    expect(res._getStatusCode()).toBe(500)
    expect(res._getJSONData()).toEqual({ error: 'The team could not be created. Please try again.' })
    expect(res.getHeader('Set-Cookie')).toBeUndefined()
  })
})
