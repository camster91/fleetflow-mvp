import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/apiAuth', () => ({
  ...jest.requireActual('@/lib/apiAuth'),
  requireTenantContext: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    teamMember: { findMany: jest.fn(), findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}))

import handler from '@/pages/api/team/index'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const member = (id: string, role: string, email: string) => ({
  id, role, status: 'ACCEPTED', invitedAt: new Date('2026-01-01'), joinedAt: new Date('2026-01-02'), userId: `user-${id}`,
  user: { id: `user-${id}`, name: `Name ${id}`, email, image: null, role: 'user', createdAt: new Date('2026-01-01') },
})

function asRole(role: string, teamId: string | null = 'team-1') {
  ;(requireTenantContext as jest.Mock).mockResolvedValue({
    session: { user: { id: 'caller', email: 'caller@example.test' } },
    tenant: { ownerId: 'owner', teamId, role, resourceWhere: teamId ? { teamId } : { ownerId: 'caller', teamId: null } },
  })
}

async function get() {
  const { req, res } = createMocks({ method: 'GET' })
  await handler(req as never, res as never)
  return res
}

describe('GET /api/team per role', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.teamMember.findMany as jest.Mock).mockResolvedValue([
      member('m1', 'OWNER', 'owner@example.test'),
      member('m2', 'DRIVER', 'driver@example.test'),
    ])
  })

  it.each(['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'])('%s gets the active workspace member list', async (role) => {
    asRole(role)
    const res = await get()
    expect(res._getStatusCode()).toBe(200)
    const body = res._getJSONData()
    expect(body.map((row: { user: { email: string } }) => row.user.email)).toEqual(['owner@example.test', 'driver@example.test'])
    // Scoped to the workspace every other tenant route resolves, not the first membership found.
    expect(prisma.teamMember.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: 'team-1' } }))
    expect(prisma.teamMember.findFirst).not.toHaveBeenCalled()
  })

  it('marks the canonical owner even when the membership row carries another role', async () => {
    asRole('ADMIN')
    ;(prisma.teamMember.findMany as jest.Mock).mockResolvedValue([{ ...member('m1', 'ADMIN', 'owner@example.test'), userId: 'owner' }])
    const res = await get()
    expect(res._getJSONData()[0]).toEqual(expect.objectContaining({ isOwner: true }))
  })

  it('includes the canonical owner when Team.ownerId has no membership row', async () => {
    asRole('ADMIN')
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'owner', name: 'Owner', email: 'real-owner@example.test', image: null, role: 'user', createdAt: new Date('2026-01-01'),
    })
    const res = await get()
    const body = res._getJSONData()
    expect(body[0]).toEqual(expect.objectContaining({ id: 'owner:owner', role: 'OWNER', isOwner: true, status: 'ACCEPTED' }))
    expect(body.map((row: { user: { email: string } }) => row.user.email)).toEqual([
      'real-owner@example.test', 'owner@example.test', 'driver@example.test',
    ])
  })

  it('does not duplicate the owner who already has a membership row', async () => {
    asRole('ADMIN')
    ;(prisma.teamMember.findMany as jest.Mock).mockResolvedValue([{ ...member('m1', 'OWNER', 'owner@example.test'), userId: 'owner' }])
    const res = await get()
    expect(res._getJSONData()).toHaveLength(1)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it.each(['DISPATCHER', 'TECHNICIAN', 'DRIVER'])('%s is refused and no member data is read', async (role) => {
    asRole(role)
    const res = await get()
    expect(res._getStatusCode()).toBe(403)
    expect(res._getData()).not.toContain('@example.test')
    expect(prisma.teamMember.findMany).not.toHaveBeenCalled()
  })

  it('returns only the caller for a personal workspace', async () => {
    asRole('OWNER', null)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'caller', name: 'Caller', email: 'caller@example.test', image: null, createdAt: new Date('2026-01-01') })
    const res = await get()
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData()).toEqual([expect.objectContaining({ id: 'caller', role: 'OWNER', isSelf: true })])
    expect(prisma.teamMember.findMany).not.toHaveBeenCalled()
  })

  it('does not respond again when the workspace cannot be resolved', async () => {
    ;(requireTenantContext as jest.Mock).mockResolvedValue(null)
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    expect(res._isEndCalled()).toBe(false)
    expect(prisma.teamMember.findMany).not.toHaveBeenCalled()
  })
})
