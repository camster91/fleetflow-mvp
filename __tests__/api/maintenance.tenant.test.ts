import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/auth', () => ({ getServerSession: jest.fn(), authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    team: { findMany: jest.fn() },
    maintenanceTask: { findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
    vehicle: { findFirst: jest.fn() },
  },
}))
jest.mock('@/lib/fleet', () => ({
  dbToMaintenanceTask: (task: unknown) => task,
  maintenanceTaskToDb: jest.fn((task, ownerId, vehicleId) => ({ ...task, ownerId, vehicleId })),
  logActivity: jest.fn(),
}))

import handler from '@/pages/api/maintenance/index'
import { getServerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

describe('maintenance tenant authorization', () => {
  beforeEach(() => jest.clearAllMocks())

  it('reads maintenance from the accepted team workspace', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'member-1' } })
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([
      { id: 'team-1', ownerId: 'owner-1', members: [{ role: 'MEMBER' }] },
    ])
    ;(prisma.maintenanceTask.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.maintenanceTask.count as jest.Mock).mockResolvedValue(0)
    const { req, res } = createMocks({ method: 'GET' })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(200)
    expect(prisma.maintenanceTask.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { teamId: 'team-1' },
    }))
  })

  it('denies a viewer from creating maintenance work', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'viewer-1' } })
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([
      { id: 'team-1', ownerId: 'owner-1', members: [{ role: 'VIEWER' }] },
    ])
    const { req, res } = createMocks({ method: 'POST', headers: { host: 'fleetflow.test' }, body: {} })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(403)
    expect(prisma.maintenanceTask.create).not.toHaveBeenCalled()
  })

  it('rejects cross-origin maintenance creation', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([
      { id: 'team-1', ownerId: 'owner-1', members: [] },
    ])
    const { req, res } = createMocks({
      method: 'POST',
      headers: { host: 'fleetflow.test', origin: 'https://attacker.example' },
      body: {},
    })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(403)
    expect(res._getJSONData()).toEqual({ error: 'Forbidden origin' })
    expect(prisma.maintenanceTask.create).not.toHaveBeenCalled()
  })
})
