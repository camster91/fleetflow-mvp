import { createMocks } from 'node-mocks-http'

const mockTx = {
  user: { upsert: jest.fn() },
  teamMember: { create: jest.fn(), update: jest.fn() },
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
    user: { findMany: jest.fn() },
    teamMember: { findMany: jest.fn() },
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
    ;(prisma.user.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.teamMember.findMany as jest.Mock).mockResolvedValue([])
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
    ;(prisma.user.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.teamMember.findMany as jest.Mock).mockResolvedValue([])
    const { req, res } = createMocks({
      method: 'POST',
      body: { teamId: 'team-1', emails: ['new@example.com'], role: 'MEMBER' },
    })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(400)
    expect(JSON.parse(res._getData())).toEqual({ error: 'Team member limit would be exceeded' })
    expect(mockTx.teamMember.create).not.toHaveBeenCalled()
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
})
