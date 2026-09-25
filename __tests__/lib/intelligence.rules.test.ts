import {
  dataQualityBlockerFindings,
  deliveryLoadFindings,
  deliveryScheduleFindings,
  INTELLIGENCE_THRESHOLDS,
  maintenanceCostFindings,
  maintenanceScheduleFindings,
  staleVehicleFindings,
  unassignedDeliveryFindings,
} from '@/lib/intelligence/rules'
import type { GenerateFindingsInput } from '@/lib/intelligence/types'

const NOW = new Date('2026-08-08T16:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

function input(records: GenerateFindingsInput['records']): GenerateFindingsInput {
  return { tenantKey: 'team-1', now: NOW, records }
}

describe('deterministic intelligence rules', () => {
  describe('maintenance schedule', () => {
    it('distinguishes overdue and due-soon tasks and links directly to each record', () => {
      const findings = maintenanceScheduleFindings(
        input({
          maintenance: [
            { id: 'overdue/id', completed: false, dueDate: new Date(NOW.getTime() - 1) },
            { id: 'due', completed: false, dueDate: NOW },
            { id: 'boundary', completed: false, dueDate: new Date(NOW.getTime() + 14 * DAY) },
            { id: 'later', completed: false, dueDate: new Date(NOW.getTime() + 14 * DAY + 1) },
            { id: 'done', completed: true, dueDate: new Date(NOW.getTime() - DAY) },
            { id: 'bad-date', completed: false, dueDate: 'not-a-date' },
          ],
        })
      )

      expect(findings.map((finding) => [finding.type, finding.evidence[0].entityId])).toEqual([
        ['maintenance-due-soon', 'boundary'],
        ['maintenance-due-soon', 'due'],
        ['maintenance-overdue', 'overdue/id'],
      ])
      expect(findings.find((finding) => finding.evidence[0].entityId === 'overdue/id')?.actionUrl).toBe(
        '/maintenance?record=overdue%2Fid'
      )
      expect(findings.every((finding) => finding.generatedAt.toISOString() === NOW.toISOString())).toBe(true)
    })
  })

  describe('maintenance cost concentration', () => {
    const completed = (id: string, vehicleId: string, actualCost: number, completedDate = NOW) => ({
      id,
      vehicleId,
      actualCost,
      completedDate,
      completed: true,
    })

    it('requires repeated, recent actual costs and uses integer cents', () => {
      const findings = maintenanceCostFindings(
        input({
          maintenance: [
            completed('a', 'vehicle-a', 333.33),
            completed('b', 'vehicle-a', 333.33),
            completed('c', 'vehicle-a', 333.34),
            completed('zero', 'vehicle-b', 0),
            completed('other-1', 'vehicle-b', 200),
            completed('other-2', 'vehicle-b', 200),
          ],
        })
      )

      expect(findings).toHaveLength(1)
      expect(findings[0]).toMatchObject({
        type: 'maintenance-cost-concentration',
        actionUrl: '/vehicles?record=vehicle-a',
      })
      expect(findings[0].evidence.map((item) => item.value)).toEqual([33333, 33333, 33334])
      expect(findings[0].explanation).toContain('71%')
    })

    it('rounds fractional cents explicitly before doing money comparisons', () => {
      const findings = maintenanceCostFindings(
        input({ maintenance: [completed('a', 'v', 499.995), completed('b', 'v', 499.995), completed('c', 'v', 0.005)] })
      )
      expect(findings[0].evidence.map((item) => item.value)).toEqual([50000, 50000, 1])
    })

    it('rejects a single large bill, invalid costs, and records outside the 90-day window', () => {
      const findings = maintenanceCostFindings(
        input({
          maintenance: [
            completed('one-large', 'one', 5000),
            completed('nan', 'one', Number.NaN),
            completed('inf', 'one', Number.POSITIVE_INFINITY),
            completed('negative', 'one', -1),
            completed('old-1', 'old', 400, new Date(NOW.getTime() - 90 * DAY - 1)),
            completed('old-2', 'old', 400, new Date(NOW.getTime() - 90 * DAY - 1)),
            completed('old-3', 'old', 400, new Date(NOW.getTime() - 90 * DAY - 1)),
          ],
        })
      )
      expect(findings).toEqual([])
    })

    it('includes the exact time-window boundary and treats zero as a valid sample', () => {
      const boundary = new Date(NOW.getTime() - INTELLIGENCE_THRESHOLDS.maintenanceCostWindowMs)
      const findings = maintenanceCostFindings(
        input({
          maintenance: [
            completed('zero', 'v', 0, boundary),
            completed('a', 'v', 500, boundary),
            completed('b', 'v', 500, boundary),
          ],
        })
      )
      expect(findings).toHaveLength(1)
      expect(findings[0].evidence).toHaveLength(3)
    })
  })

  describe('vehicle freshness', () => {
    it('applies status-specific thresholds and ignores non-operational vehicles', () => {
      const findings = staleVehicleFindings(
        input({
          vehicles: [
            { id: 'active-boundary', status: 'ACTIVE', lastUpdated: new Date(NOW.getTime() - 7 * DAY) },
            { id: 'active-stale', status: 'active', lastUpdated: new Date(NOW.getTime() - 7 * DAY - 1) },
            { id: 'delayed-boundary', status: 'delayed', updatedAt: new Date(NOW.getTime() - DAY) },
            { id: 'delayed-stale', status: 'delayed', updatedAt: new Date(NOW.getTime() - DAY - 1) },
            { id: 'maintenance-stale', status: 'maintenance', updatedAt: new Date(NOW.getTime() - 3 * DAY - 1) },
            { id: 'inactive-old', status: 'inactive', updatedAt: new Date(2000, 1, 1) },
            { id: 'bad', status: 'active', updatedAt: 'bad-date' },
          ],
        })
      )
      expect(findings.map((finding) => finding.evidence[0].entityId)).toEqual([
        'active-stale',
        'delayed-stale',
        'maintenance-stale',
      ])
      expect(findings.find((finding) => finding.evidence[0].entityId === 'delayed-stale')?.severity).toBe('high')
    })
  })

  describe('delivery operational rules', () => {
    it('flags active deliveries only after the scheduled-time grace boundary', () => {
      const grace = INTELLIGENCE_THRESHOLDS.deliveryScheduleGraceMs
      const findings = deliveryScheduleFindings(
        input({
          deliveries: [
            { id: 'pending-late', status: 'pending', scheduledTime: new Date(NOW.getTime() - grace - 1) },
            { id: 'picked-late', status: 'picked-up', scheduledTime: new Date(NOW.getTime() - grace - 60 * 60 * 1000) },
            { id: 'transit-boundary', status: 'in-transit', scheduledTime: new Date(NOW.getTime() - grace) },
            { id: 'delivered', status: 'delivered', scheduledTime: new Date(NOW.getTime() - DAY) },
            { id: 'cancelled', status: 'cancelled', scheduledTime: new Date(NOW.getTime() - DAY) },
            { id: 'failed', status: 'failed', scheduledTime: new Date(NOW.getTime() - DAY) },
            { id: 'delayed-late', status: 'delayed', scheduledTime: new Date(NOW.getTime() - DAY) },
            { id: 'invalid', status: 'pending', scheduledTime: 'not-a-date' },
          ],
        })
      )
      expect(findings.map((finding) => finding.evidence[0].entityId)).toEqual([
        'delayed-late',
        'pending-late',
        'picked-late',
      ])
      expect(findings.map((finding) => finding.severity)).toEqual(['high', 'medium', 'high'])
      expect(findings.find((finding) => finding.evidence[0].entityId === 'pending-late')?.actionUrl).toBe(
        '/deliveries?record=pending-late'
      )
    })

    it('counts active deliveries per vehicle at the documented load threshold', () => {
      const deliveries = Array.from({ length: 10 }, (_, index) => ({
        id: `delivery-${index}`,
        status: index === 9 ? 'delivered' : 'pending',
        vehicleId: index < 5 ? 'v/1' : 'v2',
      }))
      const findings = deliveryLoadFindings(input({ deliveries }))
      expect(findings).toHaveLength(1)
      expect(findings[0]).toMatchObject({ severity: 'medium', actionUrl: '/vehicles?record=v%2F1' })
      expect(findings[0].evidence).toHaveLength(5)
    })

    it('includes delayed deliveries in vehicle load and assignment rules', () => {
      const delayed = Array.from({ length: 5 }, (_, index) => ({
        id: `delayed-${index}`,
        status: 'delayed',
        driver: index === 0 ? null : 'Driver',
        vehicleId: 'v1',
      }))
      expect(deliveryLoadFindings(input({ deliveries: delayed }))).toHaveLength(1)
      const unassigned = unassignedDeliveryFindings(input({ deliveries: delayed }))
      expect(unassigned).toHaveLength(1)
      expect(unassigned[0]).toMatchObject({ severity: 'high', type: 'delivery-unassigned' })
    })

    it('creates one finding when an active delivery lacks driver, vehicle, or both', () => {
      const findings = unassignedDeliveryFindings(
        input({
          deliveries: [
            { id: 'both', status: 'pending', driver: ' ', vehicleId: null },
            { id: 'driver', status: 'picked-up', driver: null, vehicleId: 'v1' },
            { id: 'vehicle', status: 'in-transit', driver: 'Driver', vehicleId: null },
            { id: 'assigned', status: 'pending', driver: 'Driver', vehicleId: 'v1' },
            { id: 'terminal', status: 'failed', driver: null, vehicleId: null },
          ],
        })
      )
      expect(findings).toHaveLength(3)
      expect(findings[0].evidence.map((item) => item.field)).toEqual(['vehicleId', 'driver'])
      expect(findings.find((finding) => finding.evidence[0].entityId === 'driver')?.severity).toBe('high')
      expect(findings.find((finding) => finding.evidence[0].entityId === 'driver')?.actionUrl).toBe(
        '/deliveries?record=driver'
      )
    })
  })

  describe('data-quality blockers', () => {
    it('deduplicates by source field, keeps the strongest severity, and ignores caller URLs/messages', () => {
      const findings = dataQualityBlockerFindings(
        input({
          dataQualityIssues: [
            {
              entityType: 'vehicle',
              entityId: 'vehicle/1',
              field: 'mileage',
              severity: 'low',
              actionUrl: 'https://evil.invalid',
            },
            { entityType: 'vehicle', entityId: 'vehicle/1', field: 'mileage', severity: 'high' },
            { entityType: 'vehicle', entityId: 'vehicle/1', field: 'secret-token', severity: 'medium' },
          ],
        })
      )
      expect(findings).toHaveLength(2)
      expect(findings.find((finding) => finding.evidence[0].field === 'mileage')).toMatchObject({
        severity: 'high',
        actionUrl: '/vehicles?record=vehicle%2F1',
      })
      expect(findings.find((finding) => finding.evidence[0].field === 'record')?.explanation).not.toContain(
        'secret-token'
      )
      expect(new Set(findings.map((finding) => finding.id)).size).toBe(findings.length)
    })

    it('skips malformed entity types and severities', () => {
      const findings = dataQualityBlockerFindings(
        input({
          dataQualityIssues: [
            { entityType: 'secret' as never, entityId: 'v', field: 'mileage', severity: 'high' },
            { entityType: 'vehicle', entityId: 'v', field: 'mileage', severity: 'urgent' as never },
          ],
        })
      )
      expect(findings).toEqual([])
    })
  })

  it('returns no findings for empty inputs', () => {
    const empty = input({})
    expect(maintenanceScheduleFindings(empty)).toEqual([])
    expect(maintenanceCostFindings(empty)).toEqual([])
    expect(staleVehicleFindings(empty)).toEqual([])
    expect(deliveryScheduleFindings(empty)).toEqual([])
    expect(deliveryLoadFindings(empty)).toEqual([])
    expect(unassignedDeliveryFindings(empty)).toEqual([])
    expect(dataQualityBlockerFindings(empty)).toEqual([])
  })

  it('rejects an invalid clock rather than silently using wall-clock time', () => {
    expect(() => maintenanceScheduleFindings({ ...input({}), now: new Date('invalid') })).toThrow(
      'now must be a valid Date'
    )
  })

  it('rejects ambiguous or invalid string dates in every timestamp-driven rule', () => {
    const ambiguous = ['2026-08-08', '2026-08-08T12:00:00', '08/08/2026 12:00', '2026-02-30T12:00:00Z']
    for (const value of ambiguous) {
      expect(
        maintenanceScheduleFindings(input({ maintenance: [{ id: 'm', completed: false, dueDate: value }] }))
      ).toEqual([])
      expect(
        maintenanceCostFindings(
          input({
            maintenance: [
              { id: 'm1', vehicleId: 'v', completed: true, completedDate: value, actualCost: 400 },
              { id: 'm2', vehicleId: 'v', completed: true, completedDate: value, actualCost: 400 },
              { id: 'm3', vehicleId: 'v', completed: true, completedDate: value, actualCost: 400 },
            ],
          })
        )
      ).toEqual([])
      expect(staleVehicleFindings(input({ vehicles: [{ id: 'v', status: 'active', lastUpdated: value }] }))).toEqual([])
      expect(
        deliveryScheduleFindings(input({ deliveries: [{ id: 'd', status: 'pending', scheduledTime: value }] }))
      ).toEqual([])
    }
  })

  it('does not place ambiguous update timestamps into assignment or load evidence', () => {
    const deliveries = Array.from({ length: 5 }, (_, index) => ({
      id: `d-${index}`,
      status: 'delayed',
      driver: index ? 'Driver' : null,
      vehicleId: 'v',
      updatedAt: '2026-08-08T12:00:00',
    }))
    expect(deliveryLoadFindings(input({ deliveries }))[0].evidence.every((item) => item.timestamp === null)).toBe(true)
    expect(unassignedDeliveryFindings(input({ deliveries }))[0].evidence[0].timestamp).toBeNull()
  })

  it('normalizes equivalent explicit-offset instants across timestamp-driven rules', () => {
    const utc = '2026-07-01T16:00:00Z'
    const offset = '2026-07-01T12:00:00-04:00'
    const scenarios = [
      (value: string) =>
        maintenanceScheduleFindings(input({ maintenance: [{ id: 'm', completed: false, dueDate: value }] })),
      (value: string) =>
        maintenanceCostFindings(
          input({
            maintenance: [
              { id: 'm1', vehicleId: 'v', completed: true, completedDate: value, actualCost: 400 },
              { id: 'm2', vehicleId: 'v', completed: true, completedDate: value, actualCost: 400 },
              { id: 'm3', vehicleId: 'v', completed: true, completedDate: value, actualCost: 400 },
            ],
          })
        ),
      (value: string) => staleVehicleFindings(input({ vehicles: [{ id: 'v', status: 'active', lastUpdated: value }] })),
      (value: string) =>
        deliveryScheduleFindings(input({ deliveries: [{ id: 'd', status: 'pending', scheduledTime: value }] })),
    ]
    for (const scenario of scenarios) expect(scenario(offset)).toEqual(scenario(utc))
  })

  it('drops oversized, whitespace-padded, and control-character source IDs', () => {
    const invalidIds = ['x'.repeat(129), ' padded', 'line\nbreak']
    for (const id of invalidIds) {
      expect(
        maintenanceScheduleFindings(
          input({ maintenance: [{ id, completed: false, dueDate: new Date(NOW.getTime() - DAY) }] })
        )
      ).toEqual([])
      expect(
        staleVehicleFindings(
          input({ vehicles: [{ id, status: 'active', lastUpdated: new Date(NOW.getTime() - 8 * DAY) }] })
        )
      ).toEqual([])
      expect(
        deliveryScheduleFindings(
          input({ deliveries: [{ id, status: 'pending', scheduledTime: new Date(NOW.getTime() - DAY) }] })
        )
      ).toEqual([])
      expect(
        dataQualityBlockerFindings(
          input({ dataQualityIssues: [{ entityType: 'vehicle', entityId: id, field: 'mileage', severity: 'high' }] })
        )
      ).toEqual([])
    }
  })

  it.each([
    {
      name: 'maintenance schedule',
      rule: maintenanceScheduleFindings,
      key: 'maintenance',
      records: [
        { id: 'z', completed: false, dueDate: new Date(NOW.getTime() - DAY) },
        { id: 'a', completed: false, dueDate: new Date(NOW.getTime() + DAY) },
        { id: 'm', completed: false, dueDate: new Date(NOW.getTime() - 2 * DAY) },
      ],
    },
    {
      name: 'maintenance costs',
      rule: maintenanceCostFindings,
      key: 'maintenance',
      records: [
        { id: 'z3', vehicleId: 'z', completed: true, completedDate: NOW, actualCost: 400 },
        { id: 'a1', vehicleId: 'a', completed: true, completedDate: NOW, actualCost: 400 },
        { id: 'z1', vehicleId: 'z', completed: true, completedDate: NOW, actualCost: 400 },
        { id: 'a3', vehicleId: 'a', completed: true, completedDate: NOW, actualCost: 400 },
        { id: 'z2', vehicleId: 'z', completed: true, completedDate: NOW, actualCost: 400 },
        { id: 'a2', vehicleId: 'a', completed: true, completedDate: NOW, actualCost: 400 },
      ],
    },
    {
      name: 'vehicle freshness',
      rule: staleVehicleFindings,
      key: 'vehicles',
      records: [
        { id: 'z', status: 'active', lastUpdated: new Date(NOW.getTime() - 9 * DAY) },
        { id: 'a', status: 'active', lastUpdated: new Date(NOW.getTime() - 8 * DAY) },
        { id: 'm', status: 'delayed', lastUpdated: new Date(NOW.getTime() - 2 * DAY) },
      ],
    },
    {
      name: 'delivery schedule',
      rule: deliveryScheduleFindings,
      key: 'deliveries',
      records: [
        { id: 'z', status: 'pending', scheduledTime: new Date(NOW.getTime() - DAY) },
        { id: 'a', status: 'picked-up', scheduledTime: new Date(NOW.getTime() - DAY) },
        { id: 'm', status: 'in-transit', scheduledTime: new Date(NOW.getTime() - DAY) },
      ],
    },
    {
      name: 'delivery load',
      rule: deliveryLoadFindings,
      key: 'deliveries',
      records: [
        ...Array.from({ length: 5 }, (_, i) => ({ id: `z${i}`, status: 'pending', vehicleId: 'z' })),
        ...Array.from({ length: 5 }, (_, i) => ({ id: `a${i}`, status: 'pending', vehicleId: 'a' })),
      ],
    },
    {
      name: 'unassigned delivery',
      rule: unassignedDeliveryFindings,
      key: 'deliveries',
      records: [
        { id: 'z', status: 'pending', driver: null, vehicleId: null },
        { id: 'a', status: 'picked-up', driver: null, vehicleId: 'v' },
        { id: 'm', status: 'in-transit', driver: 'Driver', vehicleId: null },
      ],
    },
    {
      name: 'data quality',
      rule: dataQualityBlockerFindings,
      key: 'dataQualityIssues',
      records: [
        { entityType: 'vehicle', entityId: 'z', field: 'mileage', severity: 'high' },
        { entityType: 'delivery', entityId: 'a', field: 'driver', severity: 'medium' },
        { entityType: 'maintenance', entityId: 'm', field: 'actualCost', severity: 'low' },
      ],
    },
  ] as const)('$name output and IDs are independent of input order', ({ rule, key, records }) => {
    const forwardRecords = [...records]
    const reversedRecords = [...records].reverse()
    const shuffledRecords = [...records].sort(
      (a, b) =>
        JSON.stringify(a).length - JSON.stringify(b).length || JSON.stringify(a).localeCompare(JSON.stringify(b))
    )
    const forward = rule(input({ [key]: forwardRecords } as never))
    const reversed = rule(input({ [key]: reversedRecords } as never))
    const shuffled = rule(input({ [key]: shuffledRecords } as never))

    expect(reversed).toEqual(forward)
    expect(shuffled).toEqual(forward)
    expect(forward.map((finding) => finding.id)).toEqual([...forward.map((finding) => finding.id)].sort())
    // Rules sort copies and must leave caller-owned arrays untouched.
    expect(forwardRecords).toEqual(records)
    expect(reversedRecords).toEqual([...records].reverse())
  })
})
