import { createMocks } from 'node-mocks-http'
import handler from '../../../pages/api/drivers'
jest.mock('../../../lib/apiAuth', () => ({ requireTenantContext: jest.fn() }))
jest.mock('../../../lib/prisma', () => ({ prisma: { teamMember: { findMany: jest.fn() } } }))
import { requireTenantContext } from '../../../lib/apiAuth'
import { prisma } from '../../../lib/prisma'
const auth = requireTenantContext as jest.Mock
const findMany = prisma.teamMember.findMany as jest.Mock
describe('/api/drivers', () => {
  beforeEach(() => jest.clearAllMocks())
  it('returns only accepted DRIVER members in the selected team with safe duplicate labels', async () => {
    auth.mockResolvedValue({ session: { user: { id: 'owner' } }, tenant: { teamId: 'team-a', role: 'OWNER' } })
    findMany.mockResolvedValue([
      { user: { id: 'driver-111111', name: 'Alex' } },
      { user: { id: 'driver-222222', name: 'Alex' } },
      { user: { id: 'driver-333333', name: 'Sam' } },
    ])
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)
    expect(findMany).toHaveBeenCalledWith({
      where: { teamId: 'team-a', status: 'ACCEPTED', role: 'DRIVER', userId: { not: null } },
      select: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: 'asc' } },
      take: 100,
    })
    expect(JSON.parse(res._getData())).toEqual({
      drivers: [
        { id: 'driver-111111', name: 'Alex', label: 'Alex · 111111' },
        { id: 'driver-222222', name: 'Alex', label: 'Alex · 222222' },
        { id: 'driver-333333', name: 'Sam', label: 'Sam' },
      ],
    })
  })
  it('does not expose another team and denies non-assigning roles', async () => {
    auth.mockResolvedValue({ session: { user: { id: 'd' } }, tenant: { teamId: 'team-a', role: 'DRIVER' } })
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(403)
    expect(findMany).not.toHaveBeenCalled()
  })
  it.each(['TECHNICIAN', 'MAINTENANCE', 'DRIVER', 'VIEWER', 'MEMBER'])('returns 403 for %s', async (role) => {
    auth.mockResolvedValue({ session: { user: { id: 'x' } }, tenant: { teamId: 'team-a', role } })
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(403)
    expect(findMany).not.toHaveBeenCalled()
  })
  it.each(['OWNER', 'ADMIN', 'MANAGER', 'DISPATCHER', 'DISPATCH'])('allows %s', async (role) => {
    auth.mockResolvedValue({ session: { user: { id: 'x' } }, tenant: { teamId: 'team-a', role } })
    findMany.mockResolvedValue([])
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
  })
  it('returns an empty list for a personal workspace', async () => {
    auth.mockResolvedValue({ session: { user: { id: 'o' } }, tenant: { teamId: null, role: 'OWNER' } })
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)
    expect(JSON.parse(res._getData())).toEqual({ drivers: [] })
    expect(findMany).not.toHaveBeenCalled()
  })
})
