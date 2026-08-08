import { buildMaintenanceRisks, MAINTENANCE_RISK_TASK_LIMIT, MAINTENANCE_RISK_VEHICLE_LIMIT } from '@/pages/api/analytics/dashboard'

describe('analytics maintenance-risk projection', () => {
  const scope = { OR: [{ teamId: 'team-1' }, { ownerId: 'owner-1', teamId: null }] }

  it('uses the canonical tenant scope, bounded reads, safe projections, and deterministic ranking', async () => {
    const vehicle = {
      findMany: jest.fn().mockResolvedValue([
        { id: 'v-low', name: 'Low', year: 2024, mileage: 100, lastService: new Date('2026-01-01T00:00:00.000Z'), maintenanceDue: false },
        { id: 'v-high', name: 'High', year: 2010, mileage: 100, lastService: null, maintenanceDue: true },
      ]),
    }
    const maintenanceTask = { findMany: jest.fn().mockResolvedValue([{ id: 't1', vehicleId: 'v-high', type: 'Brakes', dueDate: new Date('2026-01-01T00:00:00.000Z'), completed: false, completedDate: null, actualCost: null }]) }
    const result = await buildMaintenanceRisks({ vehicle, maintenanceTask } as never, scope, new Date('2026-08-08T00:00:00.000Z'))
    expect(vehicle.findMany).toHaveBeenCalledWith({ where: scope, select: { id: true, name: true, year: true, mileage: true, lastService: true, maintenanceDue: true }, orderBy: { id: 'asc' }, take: MAINTENANCE_RISK_VEHICLE_LIMIT + 1 })
    expect(maintenanceTask.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { AND: [scope, { vehicleId: { in: ['v-low', 'v-high'] } }] }, take: expect.any(Number) }))
    expect(result.items.map(item => item.vehicleId)).toEqual(['v-high', 'v-low'])
    expect(result.items[0].factors[0].sourceIds).toContain('t1')
  })

  it('reports truncated coverage and never reads tasks when there are no vehicles', async () => {
    const vehicle = { findMany: jest.fn().mockResolvedValue([]) }
    const maintenanceTask = { findMany: jest.fn() }
    const empty = await buildMaintenanceRisks({ vehicle, maintenanceTask } as never, { ownerId: 'o1', teamId: null }, new Date('2026-08-08T00:00:00.000Z'))
    expect(empty).toMatchObject({ items: [], coverage: { vehiclesComplete: true, tasksComplete: true } })
    expect(maintenanceTask.findMany).not.toHaveBeenCalled()

    vehicle.findMany.mockResolvedValue(Array.from({ length: MAINTENANCE_RISK_VEHICLE_LIMIT + 1 }, (_, index) => ({ id: `v${index}`, name: `V${index}`, year: 2020, mileage: 0, lastService: null, maintenanceDue: false })))
    maintenanceTask.findMany.mockResolvedValue([])
    const bounded = await buildMaintenanceRisks({ vehicle, maintenanceTask } as never, { ownerId: 'o1', teamId: null }, new Date('2026-08-08T00:00:00.000Z'))
    expect(bounded.coverage.vehiclesComplete).toBe(false)
    expect(bounded.evaluatedVehicles).toBe(MAINTENANCE_RISK_VEHICLE_LIMIT)
  })

  it('marks each returned score incomplete instead of silently accepting the global task cap', async () => {
    const vehicle = { findMany: jest.fn().mockResolvedValue([{ id: 'v1', name: 'Van', year: 2020, mileage: 0, lastService: null, maintenanceDue: false }]) }
    const maintenanceTask = { findMany: jest.fn().mockResolvedValue(Array.from({ length: MAINTENANCE_RISK_TASK_LIMIT + 1 }, (_, index) => ({ id: `t${index}`, vehicleId: 'v1', type: 'Repair', dueDate: new Date('2027-01-01T00:00:00.000Z'), completed: false, completedDate: null, actualCost: null }))) }
    const result = await buildMaintenanceRisks({ vehicle, maintenanceTask } as never, scope, new Date('2026-08-08T00:00:00.000Z'))
    expect(result.coverage.tasksComplete).toBe(false)
    expect(result.items[0]).toMatchObject({ sourceComplete: false })
    expect(result.items[0].missingData).toContain('Maintenance task evidence was truncated; this score may omit contributing records.')
  })
})
