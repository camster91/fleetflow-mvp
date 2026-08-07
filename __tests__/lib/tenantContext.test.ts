jest.mock('@/lib/prisma', () => ({
  prisma: {
    team: { findMany: jest.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { resolveTenantContext } from '@/lib/apiAuth'

describe('resolveTenantContext', () => {
  beforeEach(() => jest.clearAllMocks())

  it('uses a private owner scope when the user has no team', async () => {
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([])

    await expect(resolveTenantContext('u1')).resolves.toMatchObject({
      ownerId: 'u1', teamId: null, role: 'OWNER', resourceWhere: { ownerId: 'u1', teamId: null },
    })
  })

  it('resolves an accepted team member to the team owner tenant', async () => {
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([
      { id: 't1', ownerId: 'owner-1', members: [{ role: 'MANAGER' }] },
    ])

    await expect(resolveTenantContext('member-1')).resolves.toMatchObject({
      ownerId: 'owner-1', teamId: 't1', role: 'MANAGER',
      resourceWhere: { OR: [{ teamId: 't1' }, { ownerId: 'owner-1', teamId: null }] },
    })
  })

  it('requires an explicit selection when multiple teams are available', async () => {
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([
      { id: 't1', ownerId: 'o1', members: [{ role: 'MEMBER' }] },
      { id: 't2', ownerId: 'o2', members: [{ role: 'VIEWER' }] },
    ])

    await expect(resolveTenantContext('u1')).rejects.toMatchObject({ code: 'TENANT_SELECTION_REQUIRED' })
  })

  it('rejects a requested team outside the user membership', async () => {
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([
      { id: 't1', ownerId: 'o1', members: [{ role: 'MEMBER' }] },
    ])

    await expect(resolveTenantContext('u1', 'other-team')).rejects.toMatchObject({ code: 'TENANT_FORBIDDEN' })
  })
})
