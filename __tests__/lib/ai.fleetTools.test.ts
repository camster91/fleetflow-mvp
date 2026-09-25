import { runFleetTool } from '@/lib/ai/fleetTools'

const scope = {
  resourceWhere: { OR: [{ teamId: 'team-1' }, { ownerId: 'owner-1', teamId: null }] },
  findingScope: { ownerId: 'owner-1', teamId: 'team-1' },
}

describe('read-only fleet tools', () => {
  it('queries overdue maintenance with an exact tenant boundary and allowlisted projection', async () => {
    const db = {
      maintenanceTask: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'm1',
            title: 'Oil service',
            dueDate: new Date('2026-08-07'),
            vehicleId: 'v1',
            vehicleName: 'Van 1',
            actualCost: null,
          },
        ]),
      },
    }
    const result = await runFleetTool({ supported: true, intent: 'maintenance_due' }, scope, {
      db: db as never,
      now: new Date('2026-08-08'),
    })
    expect(db.maintenanceTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [scope.resourceWhere, { completed: false, dueDate: { lte: new Date('2026-08-22') } }] },
        take: 25,
      })
    )
    expect(result.sources[0]).toEqual(expect.objectContaining({ id: 'maintenance:m1', href: '/maintenance?record=m1' }))
    expect(JSON.stringify(result)).not.toContain('owner-1')
  })

  it('does not expose delivery addresses, customer contacts, drivers, or notes', async () => {
    const db = {
      delivery: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'd1',
            status: 'pending',
            scheduledTime: new Date('2026-08-07'),
            vehicleId: null,
            customer: 'Private Person',
            address: 'Secret',
            notes: 'Secret',
          },
        ]),
      },
    }
    const result = await runFleetTool({ supported: true, intent: 'delivery_exceptions' }, scope, {
      db: db as never,
      now: new Date('2026-08-08'),
    })
    expect(JSON.stringify(result)).not.toMatch(/Private Person|Secret/)
    expect(result.sources[0]).toEqual(expect.objectContaining({ label: 'Delivery d1' }))
  })

  it('bounds activity date ranges and performs reads only', async () => {
    const db = {
      vehicle: { findMany: jest.fn().mockResolvedValue([]) },
      delivery: { findMany: jest.fn().mockResolvedValue([]) },
      maintenanceTask: { findMany: jest.fn().mockResolvedValue([]) },
      client: { findMany: jest.fn().mockResolvedValue([]) },
    }
    await runFleetTool(
      { supported: true, intent: 'activity', from: new Date('2026-08-01'), to: new Date('2026-08-08') },
      scope,
      { db: db as never, now: new Date('2026-08-08') }
    )
    expect(db.delivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [scope.resourceWhere, expect.any(Object)] }, take: 25 })
    )
    expect(
      Object.keys(db).every((key) => Object.keys(db[key as keyof typeof db]).every((method) => method === 'findMany'))
    ).toBe(true)
  })

  it('does not classify a future assigned pending delivery as an exception', async () => {
    const db = { delivery: { findMany: jest.fn().mockResolvedValue([]) } }
    await runFleetTool({ supported: true, intent: 'delivery_exceptions' }, scope, {
      db: db as never,
      now: new Date('2026-08-08'),
    })
    const query = db.delivery.findMany.mock.calls[0][0]
    expect(JSON.stringify(query.where)).not.toContain('"status":{"in":["pending"')
  })

  it('aggregates bounded recorded costs by vehicle and cites vehicle plus contributing maintenance records', async () => {
    const db = {
      maintenanceTask: {
        groupBy: jest.fn().mockResolvedValue([
          { vehicleId: 'v2', _sum: { actualCost: 500 }, _count: { _all: 3 } },
          { vehicleId: 'v1', _sum: { actualCost: 500 }, _count: { _all: 12 } },
        ]),
        findMany: jest.fn().mockResolvedValue([
          { id: 'm1', vehicleId: 'v1', actualCost: 20 },
          { id: 'm2', vehicleId: 'v1', actualCost: 30 },
          { id: 'm3', vehicleId: 'v2', actualCost: 40 },
        ]),
      },
      vehicle: { findMany: jest.fn().mockResolvedValue([{ id: 'v1' }, { id: 'v2' }]) },
    }
    const result = await runFleetTool({ supported: true, intent: 'cost_drivers' }, scope, {
      db: db as never,
      now: new Date('2026-08-08'),
    })
    expect(db.maintenanceTask.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [scope.resourceWhere, { actualCost: { not: null }, vehicleId: { not: null } }] },
        orderBy: [{ _sum: { actualCost: 'desc' } }, { vehicleId: 'asc' }],
        take: 5,
      })
    )
    expect(result.claims[0].text).toContain('500.00')
    expect(result.claims[0].text).toContain('12 maintenance records')
    expect(result.claims[0].citationIds).toEqual([
      'maintenanceAggregate:v1',
      'vehicle:v1',
      'maintenance:m1',
      'maintenance:m2',
    ])
    expect(result.sources.find((item) => item.id === 'maintenanceAggregate:v1')?.href).toBe(
      '/assistant/sources/maintenance-cost?vehicle=v1'
    )
    expect(result.sources.find((item) => item.id === 'vehicle:v1')?.href).toBe('/vehicles?record=v1')
  })

  it('grounds activity count in exactly the cited bounded source set', async () => {
    const vehicles = Array.from({ length: 15 }, (_, index) => ({
      id: `v${index}`,
      name: `Vehicle ${index}`,
      status: 'active',
    }))
    const db = {
      vehicle: { findMany: jest.fn().mockResolvedValue(vehicles) },
      delivery: { findMany: jest.fn().mockResolvedValue([]) },
      maintenanceTask: { findMany: jest.fn().mockResolvedValue([]) },
      client: { findMany: jest.fn().mockResolvedValue([]) },
    }
    const result = await runFleetTool(
      { supported: true, intent: 'activity', from: new Date('2026-08-01'), to: new Date('2026-08-08') },
      scope,
      { db: db as never }
    )
    expect(result.claims[0].citationIds).toHaveLength(10)
    expect(result.claims[0].text).toContain('10 source records')
  })

  it('includes bounded incomplete deliveries using progress and completedTime semantics', async () => {
    const db = {
      delivery: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'd1',
            status: 'in-transit',
            scheduledTime: new Date('2026-08-09'),
            vehicleId: 'v1',
            progress: 60,
            completedTime: null,
          },
        ]),
      },
    }
    const result = await runFleetTool({ supported: true, intent: 'delivery_exceptions' }, scope, {
      db: db as never,
      now: new Date('2026-08-08'),
    })
    const where = db.delivery.findMany.mock.calls[0][0].where
    expect(JSON.stringify(where)).toContain('"progress":{"lt":100}')
    expect(JSON.stringify(where)).toContain('"completedTime":null')
    expect(JSON.stringify(where)).toContain('"status":{"in":["in-transit"]}')
    expect(result.claims[0].text).toContain('incomplete at 60% progress')
  })
})
