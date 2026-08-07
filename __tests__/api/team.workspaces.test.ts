import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/auth', () => ({ getServerSession: jest.fn(), authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: { team: { findMany: jest.fn() } },
}))

import handler from '@/pages/api/team/workspaces'
import { getServerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

describe('/api/team/workspaces', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } })
  })

  it('lists only owned or accepted workspaces with the effective role', async () => {
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([
      { id: 'owned', name: 'Owned', ownerId: 'u1', members: [] },
      { id: 'joined', name: 'Joined', ownerId: 'u2', members: [{ role: 'MEMBER' }] },
    ])
    const { req, res } = createMocks({ method: 'GET' })

    await handler(req as never, res as never)

    expect(res._getJSONData()).toEqual({ activeTeamId: null, workspaces: [
      { id: 'owned', name: 'Owned', role: 'OWNER' },
      { id: 'joined', name: 'Joined', role: 'MEMBER' },
    ] })
  })

  it('sets an HTTP-only workspace cookie after access validation', async () => {
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([
      { id: 'joined', name: 'Joined', ownerId: 'u2', members: [{ role: 'MEMBER' }] },
    ])
    const { req, res } = createMocks({ method: 'POST', body: { teamId: 'joined' } })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(200)
    expect(res.getHeader('set-cookie')).toEqual(expect.stringContaining('fleetflow_team=joined'))
  })

  it('rejects selecting a workspace outside the user membership', async () => {
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([])
    const { req, res } = createMocks({ method: 'POST', body: { teamId: 'other' } })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(403)
    expect(res.getHeader('set-cookie')).toBeUndefined()
  })
})
