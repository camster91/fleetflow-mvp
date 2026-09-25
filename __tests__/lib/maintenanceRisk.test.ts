import { MAINTENANCE_RISK_RUBRIC, maintenanceRiskBand, scoreMaintenanceRisk } from '@/lib/intelligence/maintenanceRisk'

const now = new Date('2026-08-08T12:00:00.000Z')
const base = {
  vehicle: {
    id: 'veh-1',
    name: 'Van 1',
    year: 2022,
    mileage: 50_000,
    lastService: '2026-05-01T00:00:00.000Z',
    maintenanceDue: false,
  },
  tasks: [] as Array<Record<string, unknown>>,
  serviceMileage: 50_000,
  currency: 'CAD',
  costUnit: 'major' as const,
}

describe('transparent maintenance risk scoring', () => {
  it('publishes a versioned deterministic rubric and produces a low no-record result', () => {
    expect(MAINTENANCE_RISK_RUBRIC.version).toMatch(/^maintenance-risk-v\d+$/)
    const result = scoreMaintenanceRisk(base, { now })
    expect(result).toMatchObject({
      vehicleId: 'veh-1',
      score: 0,
      band: 'low',
      rubricVersion: MAINTENANCE_RISK_RUBRIC.version,
    })
    expect(result.generatedAt).toBe(now.toISOString())
    expect(result.factors).toEqual([])
    expect(result.wording).not.toMatch(/probab|predict|failure chance/i)
  })

  it.each([
    ['on the due instant', '2026-08-08T12:00:00.000Z', 0],
    ['one day overdue', '2026-08-07T12:00:00.000Z', 10],
    ['eight days overdue', '2026-07-31T12:00:00.000Z', 20],
    ['thirty-one days overdue', '2026-07-08T11:59:59.999Z', 30],
  ])('%s has the documented overdue points', (_label, dueDate, points) => {
    const result = scoreMaintenanceRisk(
      { ...base, tasks: [{ id: 'task-1', type: 'Oil', dueDate, completed: false }] },
      { now }
    )
    expect(result.factors.find((f) => f.code === 'overdue-maintenance')?.points ?? 0).toBe(points)
  })

  it('ignores overdue dates and open flags on completed tasks', () => {
    const result = scoreMaintenanceRisk(
      {
        ...base,
        tasks: [{ id: 'task-1', type: 'Oil', dueDate: '2020-01-01T00:00:00.000Z', completed: true, priority: 'high' }],
      },
      { now }
    )
    expect(result.score).toBe(0)
  })

  it('scores bounded mileage since service and rejects negative and extreme values', () => {
    expect(
      scoreMaintenanceRisk(
        { ...base, vehicle: { ...base.vehicle, mileage: 55_001 }, serviceMileage: 45_000 },
        { now }
      ).factors.find((f) => f.code === 'mileage-since-service')?.points
    ).toBe(12)
    for (const mileage of [-1, Number.MAX_SAFE_INTEGER + 1, Number.NaN]) {
      const result = scoreMaintenanceRisk({ ...base, vehicle: { ...base.vehicle, mileage } }, { now })
      expect(result.factors.some((f) => f.code === 'mileage-since-service')).toBe(false)
      expect(result.missingData).toContain('Valid current mileage is unavailable.')
    }
  })

  it('scores repeated open categories once with stable source ordering', () => {
    const tasks = ['b', 'a', 'c'].map((id, i) => ({
      id,
      type: 'Oil Change',
      dueDate: `2026-09-0${i + 1}T00:00:00.000Z`,
      completed: false,
    }))
    const factor = scoreMaintenanceRisk({ ...base, tasks }, { now }).factors.find(
      (f) => f.code === 'repeated-category'
    )!
    expect(factor.points).toBe(12)
    expect(factor.sourceIds).toEqual(['a', 'b', 'c'])
  })

  it('uses recorded major-unit costs only and requires comparable currency', () => {
    const tasks = [
      { id: 'old-1', type: 'Repair', completed: true, completedDate: '2025-01-01T00:00:00.000Z', actualCost: 100 },
      { id: 'old-2', type: 'Repair', completed: true, completedDate: '2025-02-01T00:00:00.000Z', actualCost: 100 },
      { id: 'new-1', type: 'Repair', completed: true, completedDate: '2026-01-01T00:00:00.000Z', actualCost: 300 },
      { id: 'new-2', type: 'Repair', completed: true, completedDate: '2026-02-01T00:00:00.000Z', actualCost: 300 },
    ]
    expect(
      scoreMaintenanceRisk({ ...base, tasks }, { now }).factors.find((f) => f.code === 'recorded-cost-trend')?.points
    ).toBe(15)
    const ambiguous = scoreMaintenanceRisk({ ...base, tasks, costUnit: 'minor' }, { now })
    expect(ambiguous.factors.some((f) => f.code === 'recorded-cost-trend')).toBe(false)
    expect(ambiguous.missingData).toContain('Recorded costs are not in supported major currency units.')
  })

  it('scores age and vehicle maintenance flag without claiming prediction', () => {
    const result = scoreMaintenanceRisk(
      { ...base, vehicle: { ...base.vehicle, year: 2010, maintenanceDue: true } },
      { now }
    )
    expect(result.factors.map((f) => [f.code, f.points])).toEqual(
      expect.arrayContaining([
        ['open-maintenance-flag', 15],
        ['vehicle-age', 10],
      ])
    )
    expect(JSON.stringify(result)).not.toMatch(/probability|predicted failure|failure chance/i)
  })

  it('does not double count a generic maintenance flag already represented by an overdue task', () => {
    const result = scoreMaintenanceRisk(
      {
        ...base,
        vehicle: { ...base.vehicle, maintenanceDue: true },
        tasks: [{ id: 'task-1', type: 'Brakes', dueDate: '2026-07-01T00:00:00.000Z', completed: false }],
      },
      { now }
    )
    expect(result.factors.some((factor) => factor.code === 'overdue-maintenance')).toBe(true)
    expect(result.factors.some((factor) => factor.code === 'open-maintenance-flag')).toBe(false)
  })

  it('reports invalid ISO dates, future years, stale service data, and completeness without local-time drift', () => {
    const result = scoreMaintenanceRisk(
      {
        vehicle: {
          id: 'veh-1',
          name: 'Van',
          year: 2030,
          mileage: null,
          lastService: '08/01/2025',
          maintenanceDue: false,
        },
        tasks: [{ id: 't1', type: '', dueDate: 'not-a-date', completed: false }],
        serviceMileage: null,
      },
      { now }
    )
    expect(result.completeness.percent).toBeLessThan(50)
    expect(result.missingData).toEqual(
      expect.arrayContaining([
        'Valid current mileage is unavailable.',
        'Vehicle year is unavailable or outside the supported range.',
        'Last service date must be an exact ISO timestamp.',
      ])
    )
  })

  it('caps score, ranks factors by points then stable code, and exposes record links', () => {
    const tasks = [
      { id: 'z', type: 'Repair', dueDate: '2026-01-01T00:00:00.000Z', completed: false },
      { id: 'a', type: 'Repair', dueDate: '2026-01-02T00:00:00.000Z', completed: false },
      { id: 'b', type: 'Repair', dueDate: '2026-01-03T00:00:00.000Z', completed: false },
    ]
    const result = scoreMaintenanceRisk(
      { ...base, vehicle: { ...base.vehicle, year: 2000, maintenanceDue: true }, tasks },
      { now }
    )
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.factors.flatMap((f) => f.links)).toEqual(
      expect.arrayContaining(['/vehicles/veh-1', '/maintenance?record=a'])
    )
    expect([...result.factors].sort((a, b) => b.points - a.points || a.code.localeCompare(b.code))).toEqual(
      result.factors
    )
  })

  it.each([
    [24, 'low'],
    [25, 'watch'],
    [49, 'watch'],
    [50, 'high'],
  ] as const)('maps exact score boundary %i to %s', (score, band) => {
    expect(maintenanceRiskBand(score)).toBe(band)
  })

  it.each([
    [4_999, 0],
    [5_000, 6],
    [9_999, 6],
    [10_000, 12],
  ])('applies exact mileage threshold %i', (distance, points) => {
    const result = scoreMaintenanceRisk(
      { ...base, vehicle: { ...base.vehicle, mileage: 50_000 + distance }, serviceMileage: 50_000 },
      { now }
    )
    expect(result.factors.find((f) => f.code === 'mileage-since-service')?.points ?? 0).toBe(points)
  })

  it.each([
    [1, 0],
    [2, 8],
    [3, 12],
  ])('applies exact repeated-category threshold %i', (count, points) => {
    const tasks = Array.from({ length: count }, (_, i) => ({
      id: `t${i}`,
      type: 'Brakes',
      dueDate: '2026-09-01T00:00:00.000Z',
      completed: false,
    }))
    expect(
      scoreMaintenanceRisk({ ...base, tasks }, { now }).factors.find((f) => f.code === 'repeated-category')?.points ?? 0
    ).toBe(points)
  })

  it.each([
    [2018, 5],
    [2014, 10],
  ])('applies exact vehicle-age threshold for model year %i', (year, points) => {
    expect(
      scoreMaintenanceRisk({ ...base, vehicle: { ...base.vehicle, year } }, { now }).factors.find(
        (f) => f.code === 'vehicle-age'
      )?.points
    ).toBe(points)
  })

  it.each([
    [1_249, 0],
    [1_250, 10],
    [1_749, 10],
    [1_750, 15],
  ])('applies cost percent and amount boundary at recent average %i', (recentCost, points) => {
    const tasks = [
      { id: 'o1', completed: true, completedDate: '2025-01-01T00:00:00.000Z', actualCost: 1_000 },
      { id: 'o2', completed: true, completedDate: '2025-02-01T00:00:00.000Z', actualCost: 1_000 },
      { id: 'n1', completed: true, completedDate: '2026-01-01T00:00:00.000Z', actualCost: recentCost },
      { id: 'n2', completed: true, completedDate: '2026-02-01T00:00:00.000Z', actualCost: recentCost },
    ]
    expect(
      scoreMaintenanceRisk({ ...base, tasks }, { now }).factors.find((f) => f.code === 'recorded-cost-trend')?.points ??
        0
    ).toBe(points)
  })

  it('marks cost data unavailable until four valid observations and reports invalid cost/date rows', () => {
    const result = scoreMaintenanceRisk(
      {
        ...base,
        tasks: [
          { id: 'a', completed: true, completedDate: '2026-01-01T00:00:00.000Z', actualCost: 100 },
          { id: 'b', completed: true, completedDate: 'not-iso', actualCost: 200 },
          { id: 'c', completed: true, completedDate: '2026-02-01T00:00:00.000Z', actualCost: -1 },
        ],
      },
      { now }
    )
    expect(result.missingData).toEqual(
      expect.arrayContaining([
        'At least four valid completed maintenance cost observations are required.',
        '2 completed maintenance cost observations have missing or invalid cost/date values.',
      ])
    )
    expect(result.completeness.available).toBeLessThan(result.completeness.expected)
  })

  it('marks every score incomplete when its bounded maintenance source was truncated', () => {
    const result = scoreMaintenanceRisk({ ...base, sourceComplete: false }, { now })
    expect(result.sourceComplete).toBe(false)
    expect(result.missingData).toContain(
      'Maintenance task evidence was truncated; this score may omit contributing records.'
    )
  })

  it('detects its own 500-task truncation even when the caller claims the source is complete', () => {
    const tasks = Array.from({ length: 501 }, (_, index) => ({
      id: `task-${index}`,
      type: `Category ${index}`,
      dueDate: '2027-01-01T00:00:00.000Z',
      completed: false,
    }))
    const result = scoreMaintenanceRisk({ ...base, tasks, sourceComplete: true }, { now })
    expect(result.sourceComplete).toBe(false)
    expect(result.missingData).toContain(
      'Maintenance task evidence was truncated; this score may omit contributing records.'
    )
  })

  it('treats a future last-service timestamp as unavailable rather than complete', () => {
    const valid = scoreMaintenanceRisk(base, { now })
    const future = scoreMaintenanceRisk(
      { ...base, vehicle: { ...base.vehicle, lastService: '2026-08-08T12:00:00.001Z' } },
      { now }
    )
    expect(future.missingData).toContain('Last service date is in the future.')
    expect(future.completeness.available).toBe(valid.completeness.available - 1)
  })

  it.each([
    [199.99, 0],
    [200, 15],
  ] as const)('applies the independent 100-unit cost-increase boundary at recent average %s', (recentCost, points) => {
    const tasks = [
      { id: 'o1', completed: true, completedDate: '2025-01-01T00:00:00.000Z', actualCost: 100 },
      { id: 'o2', completed: true, completedDate: '2025-02-01T00:00:00.000Z', actualCost: 100 },
      { id: 'n1', completed: true, completedDate: '2026-01-01T00:00:00.000Z', actualCost: recentCost },
      { id: 'n2', completed: true, completedDate: '2026-02-01T00:00:00.000Z', actualCost: recentCost },
    ]
    expect(
      scoreMaintenanceRisk({ ...base, tasks }, { now }).factors.find((f) => f.code === 'recorded-cost-trend')?.points ??
        0
    ).toBe(points)
  })

  it.each([
    [2019, 0],
    [2018, 5],
    [2015, 5],
    [2014, 10],
  ] as const)('handles the year immediately around age thresholds for %i', (year, points) => {
    expect(
      scoreMaintenanceRisk({ ...base, vehicle: { ...base.vehicle, year } }, { now }).factors.find(
        (f) => f.code === 'vehicle-age'
      )?.points ?? 0
    ).toBe(points)
  })
})
