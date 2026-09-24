import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/auth', () => ({
  getServerSession: jest.fn(),
  authOptions: {},
}))
jest.mock('@/lib/apiAuth', () => ({ assertSameOrigin: jest.fn(() => true) }))
jest.mock('@/lib/teamDriverCleanup', () => ({ clearDriverAssignments: jest.fn() }))
jest.mock('@/lib/prisma', () => {
  const teamMember = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }
  return {
    prisma: {
      teamMember,
      $transaction: jest.fn((callback: (client: unknown) => unknown) => callback({ teamMember })),
    },
  }
})

import handler from '@/pages/api/team/members'
import { getServerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function actAs(userId: string, membershipRole: string | null) {
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: userId, name: userId } })
  ;(prisma.teamMember.findFirst as jest.Mock).mockImplementation(async ({ where }) => {
    if (!membershipRole) return null
    if (where.role && where.role !== membershipRole) return null
    return { role: membershipRole, status: 'ACCEPTED' }
  })
}

function target(role: string, userId = 'peer-admin') {
  ;(prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({
    id: 'm-target', teamId: 't1', role, userId, team: { ownerId: 'owner-1' },
  })
}

describe('/api/team/members — admins are peers', () => {
  beforeEach(() => jest.clearAllMocks())

  it('forbids an admin from changing another admin role', async () => {
    actAs('admin-1', 'ADMIN')
    target('ADMIN')
    const { req, res } = createMocks({ method: 'PUT', body: { memberId: 'm-target', role: 'VIEWER' } })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(403)
    expect(prisma.teamMember.update).not.toHaveBeenCalled()
  })

  it('forbids an admin from removing another admin', async () => {
    actAs('admin-1', 'ADMIN')
    target('ADMIN')
    const { req, res } = createMocks({ method: 'DELETE', query: { memberId: 'm-target' } })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(403)
    expect(prisma.teamMember.delete).not.toHaveBeenCalled()
  })

  it('still lets an admin change and remove a non-admin member', async () => {
    actAs('admin-1', 'ADMIN')
    target('MEMBER', 'member-1')
    ;(prisma.teamMember.update as jest.Mock).mockResolvedValue({ id: 'm-target' })
    const put = createMocks({ method: 'PUT', body: { memberId: 'm-target', role: 'VIEWER' } })
    await handler(put.req as never, put.res as never)
    expect(put.res._getStatusCode()).toBe(200)

    const del = createMocks({ method: 'DELETE', query: { memberId: 'm-target' } })
    await handler(del.req as never, del.res as never)
    expect(del.res._getStatusCode()).toBe(200)
    expect(prisma.teamMember.delete).toHaveBeenCalled()
  })

  it('lets the owner change and remove an admin', async () => {
    actAs('owner-1', null)
    target('ADMIN')
    ;(prisma.teamMember.update as jest.Mock).mockResolvedValue({ id: 'm-target' })
    const put = createMocks({ method: 'PUT', body: { memberId: 'm-target', role: 'MEMBER' } })
    await handler(put.req as never, put.res as never)
    expect(put.res._getStatusCode()).toBe(200)

    const del = createMocks({ method: 'DELETE', query: { memberId: 'm-target' } })
    await handler(del.req as never, del.res as never)
    expect(del.res._getStatusCode()).toBe(200)
  })
})
