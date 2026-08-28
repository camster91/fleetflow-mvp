import { createMocks } from 'node-mocks-http'

const mockTx = {
  $executeRaw: jest.fn(),
  user: { findMany: jest.fn(), upsert: jest.fn() },
  teamMember: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}

jest.mock('@/lib/auth', () => ({
  getServerSession: jest.fn(),
  authOptions: {},
}))
jest.mock('@/lib/apiAuth', () => ({ assertSameOrigin: jest.fn(() => true) }))
jest.mock('@/lib/email', () => ({
  sendTeamInvitationEmail: jest.fn(async () => ({ success: true })),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    team: { findFirst: jest.fn() },
    $transaction: jest.fn((callback: (client: typeof mockTx) => unknown) => callback(mockTx)),
  },
}))

import handler from '@/pages/api/team/invite'
import { getServerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendTeamInvitationEmail } from '@/lib/email'

describe('team invitation provisioning', () => {
  beforeEach(() => jest.clearAllMocks())

  it('provisions a passwordless account and emails an invitation-specific URL', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'owner-1', email: 'owner@example.com', name: 'Owner' },
    })
    ;(prisma.team.findFirst as jest.Mock).mockResolvedValue({
      id: 'team-1', name: 'Acme', ownerId: 'owner-1', members: [],
    })
    ;mockTx.user.findMany.mockResolvedValue([])
    ;mockTx.teamMember.findMany.mockResolvedValue([])
    mockTx.teamMember.count.mockResolvedValue(0)
    mockTx.user.upsert.mockResolvedValue({ id: 'invited-user' })
    mockTx.teamMember.create.mockResolvedValue({ id: 'invite-1' })
    const { req, res } = createMocks({
      method: 'POST',
      body: { teamId: 'team-1', emails: ['new@example.com'], role: 'MEMBER' },
    })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(200)
    expect(mockTx.user.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: 'new@example.com' },
      create: { email: 'new@example.com', role: 'viewer' },
      update: {},
    }))
    expect(mockTx.teamMember.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'invited-user', inviteeEmail: 'new@example.com' }),
    }))
    expect(sendTeamInvitationEmail).toHaveBeenCalledWith(
      'new@example.com', 'Owner', 'MEMBER', 'Acme', 'invite-1'
    )
  })

  it('counts pending invitations against the team seat limit', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'owner-1', email: 'owner@example.com', name: 'Owner' },
    })
    ;(prisma.team.findFirst as jest.Mock).mockResolvedValue({
      id: 'team-1',
      name: 'Acme',
      ownerId: 'owner-1',
      members: Array.from({ length: 10 }, (_, index) => ({
        id: `member-${index}`,
        status: index === 9 ? 'PENDING' : 'ACCEPTED',
      })),
    })
    ;mockTx.user.findMany.mockResolvedValue([])
    ;mockTx.teamMember.findMany.mockResolvedValue([])
    mockTx.teamMember.count.mockResolvedValue(10)
    const { req, res } = createMocks({
      method: 'POST',
      body: { teamId: 'team-1', emails: ['new@example.com'], role: 'MEMBER' },
    })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(400)
    expect(JSON.parse(res._getData())).toEqual({ error: 'Team member limit would be exceeded' })
    expect(mockTx.teamMember.create).not.toHaveBeenCalled()
  })

  it('does not treat a non-owner OWNER label as canonical ownership', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'legacy-owner-label', email: 'legacy@example.com', name: 'Legacy' },
    })
    ;(prisma.team.findFirst as jest.Mock).mockResolvedValue(null)
    const { req, res } = createMocks({
      method: 'POST',
      body: { teamId: 'team-1', emails: ['new@example.com'], role: 'MEMBER' },
    })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(403)
    expect(mockTx.teamMember.create).not.toHaveBeenCalled()
    expect(mockTx.teamMember.update).not.toHaveBeenCalled()
  })

  it('does not let an ADMIN invite another ADMIN', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@example.com', name: 'Admin' },
    })
    ;(prisma.team.findFirst as jest.Mock).mockResolvedValue({
      id: 'team-1', name: 'Acme', ownerId: 'owner-1',
      members: [{ userId: 'admin-1', role: 'ADMIN', status: 'ACCEPTED' }],
    })
    const { req, res } = createMocks({
      method: 'POST', body: { teamId: 'team-1', emails: ['new@example.com'], role: 'ADMIN' },
    })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(403)
    expect(mockTx.teamMember.create).not.toHaveBeenCalled()
    expect(mockTx.teamMember.update).not.toHaveBeenCalled()
  })
  it('reactivates an existing declined invitation instead of creating a duplicate membership', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'owner-1', email: 'owner@example.com', name: 'Owner' },
    })
    ;(prisma.team.findFirst as jest.Mock).mockResolvedValue({
      id: 'team-1', name: 'Acme', ownerId: 'owner-1', members: [],
    })
    mockTx.user.findMany.mockResolvedValue([
      { id: 'invited-user', email: 'returning@example.com' },
    ])
    mockTx.teamMember.findMany.mockResolvedValue([
      {
        id: 'invite-old',
        teamId: 'team-1',
        userId: 'invited-user',
        inviteeEmail: 'returning@example.com',
        status: 'DECLINED',
      },
    ])
    mockTx.teamMember.count.mockResolvedValue(3)
    mockTx.teamMember.update.mockResolvedValue({ id: 'invite-old' })
    const { req, res } = createMocks({
      method: 'POST',
      body: { teamId: 'team-1', emails: ['returning@example.com'], role: 'MEMBER' },
    })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(200)
    expect(mockTx.teamMember.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'invite-old' },
      data: expect.objectContaining({ status: 'PENDING' }),
    }))
    expect(mockTx.teamMember.create).not.toHaveBeenCalled()
  })

})
