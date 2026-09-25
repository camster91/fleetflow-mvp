import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/auth', () => ({ getServerSession: jest.fn(), authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: { teamMember: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() } },
}))

import handler from '@/pages/api/team/accept-invite'
import { getServerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const sameOrigin = { host: 'app.test', origin: 'http://app.test' }

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    status: 'PENDING',
    invitedAt: new Date(),
    userId: null,
    inviteeEmail: 'Invitee@Example.test',
    user: null,
    team: { name: 'Acme Fleet' },
    ...overrides,
  }
}

function signedInAs(id: string, email: string) {
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id, email } })
}

async function post(body: unknown, headers: Record<string, string> = sameOrigin) {
  const { req, res } = createMocks({ method: 'POST', headers, body: body as never })
  await handler(req as never, res as never)
  return res
}

describe('POST /api/team/accept-invite', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.teamMember.findUnique as jest.Mock).mockResolvedValue(invitation())
    ;(prisma.teamMember.update as jest.Mock).mockResolvedValue({})
    ;(prisma.teamMember.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    signedInAs('u-invitee', 'invitee@example.test')
  })

  it('rejects other methods', async () => {
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(405)
  })

  it('rejects cross-origin requests', async () => {
    const res = await post({ invitationId: 'inv-1', accept: true }, { host: 'app.test', origin: 'https://evil.test' })
    expect(res._getStatusCode()).toBe(403)
    expect(prisma.teamMember.findUnique).not.toHaveBeenCalled()
  })

  it('requires an invitation id', async () => {
    const res = await post({ accept: true })
    expect(res._getStatusCode()).toBe(400)
  })

  it('returns 404 for an unknown invitation', async () => {
    ;(prisma.teamMember.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await post({ invitationId: 'nope', accept: true })
    expect(res._getStatusCode()).toBe(404)
  })

  it('rejects an invitation that is no longer pending', async () => {
    ;(prisma.teamMember.findUnique as jest.Mock).mockResolvedValue(invitation({ status: 'ACCEPTED' }))
    const res = await post({ invitationId: 'inv-1', accept: true })
    expect(res._getStatusCode()).toBe(400)
    expect(prisma.teamMember.updateMany).not.toHaveBeenCalled()
  })

  it('expires a stale invitation and returns 410', async () => {
    ;(prisma.teamMember.findUnique as jest.Mock).mockResolvedValue(invitation({ invitedAt: new Date('2020-01-01') }))
    const res = await post({ invitationId: 'inv-1', accept: true })
    expect(res._getStatusCode()).toBe(410)
    expect(prisma.teamMember.update).toHaveBeenCalledWith({ where: { id: 'inv-1' }, data: { status: 'EXPIRED' } })
    expect(prisma.teamMember.updateMany).not.toHaveBeenCalled()
  })

  it('tells a signed-out invitee which team invited them', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = await post({ invitationId: 'inv-1', accept: true })
    expect(res._getStatusCode()).toBe(401)
    expect(res._getJSONData()).toEqual({
      error: 'Authentication required',
      requiresSignup: true,
      canLogin: true,
      teamName: 'Acme Fleet',
    })
  })

  it('refuses an email invitation for a different signed-in email', async () => {
    signedInAs('u-other', 'other@example.test')
    const res = await post({ invitationId: 'inv-1', accept: true })
    expect(res._getStatusCode()).toBe(403)
    expect(prisma.teamMember.updateMany).not.toHaveBeenCalled()
  })

  it('refuses a user invitation for a different signed-in user', async () => {
    ;(prisma.teamMember.findUnique as jest.Mock).mockResolvedValue(
      invitation({ userId: 'u-invitee', inviteeEmail: null, user: { email: 'invitee@example.test' } })
    )
    signedInAs('u-other', 'invitee@example.test')
    const res = await post({ invitationId: 'inv-1', accept: true })
    expect(res._getStatusCode()).toBe(403)
  })

  it('rejects an invitation with no intended recipient', async () => {
    ;(prisma.teamMember.findUnique as jest.Mock).mockResolvedValue(invitation({ inviteeEmail: null }))
    const res = await post({ invitationId: 'inv-1', accept: true })
    expect(res._getStatusCode()).toBe(400)
  })

  it('accepts only while the invitation is still pending', async () => {
    const res = await post({ invitationId: 'inv-1', accept: true })
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData()).toEqual({ success: true, status: 'ACCEPTED', team: 'Acme Fleet' })
    expect(prisma.teamMember.updateMany).toHaveBeenCalledWith({
      where: { id: 'inv-1', status: 'PENDING' },
      data: {
        status: 'ACCEPTED',
        joinedAt: expect.any(Date),
        userId: 'u-invitee',
        inviteeEmail: 'invitee@example.test',
      },
    })
  })

  it('declines without a join date', async () => {
    const res = await post({ invitationId: 'inv-1', accept: false })
    expect(res._getJSONData().status).toBe('DECLINED')
    expect((prisma.teamMember.updateMany as jest.Mock).mock.calls[0][0].data.joinedAt).toBeNull()
  })

  it('returns 409 when a concurrent response or revoke already changed the invitation', async () => {
    ;(prisma.teamMember.updateMany as jest.Mock).mockResolvedValue({ count: 0 })
    const res = await post({ invitationId: 'inv-1', accept: true })
    expect(res._getStatusCode()).toBe(409)
    expect(res._getJSONData()).toEqual({ error: 'Invitation is no longer pending' })
  })
})
