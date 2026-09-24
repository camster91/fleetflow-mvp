import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/auth', () => ({ getServerSession: jest.fn(), authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    teamMember: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    team: { findFirst: jest.fn() },
  },
}))

import handler from '@/pages/api/team/members'
import { getServerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const call = async (query: Record<string, string> = { teamId: 'team-1' }) => {
  const { req, res } = createMocks({ method: 'GET', query })
  await handler(req as never, res as never)
  return res
}

describe('GET /api/team/members', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.team.findFirst as jest.Mock).mockResolvedValue({ id: 'team-1' })
    ;(prisma.teamMember.findFirst as jest.Mock).mockResolvedValue({ role: 'MEMBER', status: 'ACCEPTED' })
    ;(prisma.teamMember.findMany as jest.Mock).mockResolvedValue([{ id: 'm1' }])
    ;(prisma.teamMember.count as jest.Mock).mockResolvedValue(1)
  })

  it('returns 401 without a session', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = await call()
    expect(res._getStatusCode()).toBe(401)
    expect(prisma.teamMember.findMany).not.toHaveBeenCalled()
  })

  it('requires a teamId', async () => {
    const res = await call({})
    expect(res._getStatusCode()).toBe(400)
  })

  it('denies users who neither own nor belong to the team', async () => {
    ;(prisma.team.findFirst as jest.Mock).mockResolvedValue(null)
    const res = await call()
    expect(res._getStatusCode()).toBe(403)
    expect(prisma.teamMember.findMany).not.toHaveBeenCalled()
    expect((prisma.team.findFirst as jest.Mock).mock.calls[0][0].where).toEqual({
      id: 'team-1',
      OR: [{ ownerId: 'user-1' }, { members: { some: { userId: 'user-1', status: 'ACCEPTED' } } }],
    })
  })

  it('returns a bounded page of members for team members', async () => {
    const res = await call({ teamId: 'team-1', page: '2', limit: '500' })
    expect(res._getStatusCode()).toBe(200)
    expect(prisma.teamMember.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: 'team-1' }, skip: 100, take: 100 }))
    expect(res._getJSONData()).toEqual({ members: [{ id: 'm1' }], total: 1, page: 2, limit: 100, hasMore: false })
    const userSelect = (prisma.teamMember.findMany as jest.Mock).mock.calls[0][0].include.user.select
    expect(Object.keys(userSelect).sort()).toEqual(['email', 'id', 'image', 'name'])
  })
})
