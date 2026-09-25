import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    team: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    vehicle: { count: jest.fn(async () => 0), findMany: jest.fn(async () => []) },
    delivery: { count: jest.fn(async () => 0), groupBy: jest.fn(async () => []) },
    maintenanceTask: {
      count: jest.fn(async () => 0),
      aggregate: jest.fn(async () => ({ _sum: { costEstimate: 0 } })),
      findMany: jest.fn(async () => [
        { vehicleName: 'Van', type: 'Oil', dueDate: new Date('2026-12-01T00:00:00.000Z') },
      ]),
      groupBy: jest.fn(async () => []),
    },
    client: { count: jest.fn(async () => 0) },
    auditLog: { findMany: jest.fn(async () => []) },
  },
}))
jest.mock('@/lib/apiAuth', () => ({
  requireTenantContext: jest.fn(async () => ({
    session: { user: { id: 'u1' } },
    tenant: {
      ownerId: 'o1',
      teamId: 'team-1',
      role: 'OWNER',
      resourceWhere: { teamId: 'team-1' },
      auditWhere: { teamId: 'team-1' },
    },
  })),
}))

import handler from '@/pages/api/analytics/dashboard'
import { prisma } from '@/lib/prisma'

describe('GET /api/analytics/dashboard workspace "today"', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // 23:30 PST on 2026-12-01 is 07:30 UTC on 2026-12-02.
    jest.useFakeTimers({
      now: new Date('2026-12-02T07:30:00.000Z'),
      doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
    })
    ;(prisma.team.findUnique as jest.Mock).mockResolvedValue({ timeZone: 'America/Vancouver' })
  })
  afterEach(() => jest.useRealTimers())

  it('counts overdue and upcoming against the workspace calendar day', async () => {
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(200)

    const today = new Date('2026-12-01T00:00:00.000Z')
    const countWheres = (prisma.maintenanceTask.count as jest.Mock).mock.calls.map(([arg]) => arg.where)
    expect(countWheres).toContainEqual({ teamId: 'team-1', completed: false, dueDate: { lt: today } })
    expect(countWheres).toContainEqual({
      teamId: 'team-1',
      completed: false,
      dueDate: { gte: today, lte: new Date('2026-12-15T00:00:00.000Z') },
    })
    // A task due on the Vancouver "today" is due in 0 days, not overdue.
    expect(res._getJSONData().stats.maintenance.upcoming).toEqual([{ vehicle: 'Van', task: 'Oil', dueIn: 0 }])
  })
})
