import { DATA_QUALITY_THRESHOLDS, assessDataQuality, type DataQualityRecords } from '@/lib/intelligence/dataQuality'

const NOW = new Date('2026-08-08T12:00:00.000Z')
const recent = new Date('2026-08-08T10:00:00.000Z')

const emptyRecords = (): DataQualityRecords => ({
  vehicles: [],
  deliveries: [],
  maintenance: [],
  clients: [],
})

describe('assessDataQuality', () => {
  it('reports status-aware missing fleet data with stable safe links', () => {
    const records = emptyRecords()
    records.vehicles.push({
      id: 'vehicle-1',
      status: 'active',
      mileage: 0,
      driver: null,
      lastService: null,
      nextService: null,
      updatedAt: recent,
      lastUpdated: recent,
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
    })
    records.deliveries.push({
      id: 'delivery-1',
      status: 'in-transit',
      vehicleId: null,
      driver: ' ',
      scheduledTime: null,
      estimatedArrival: null,
      contactPerson: null,
      updatedAt: recent,
    })

    const result = assessDataQuality(records, NOW)

    expect(result).toEqual(
      expect.arrayContaining([
        {
          id: 'vehicle:vehicle-1:mileage',
          entityType: 'vehicle',
          entityId: 'vehicle-1',
          severity: 'high',
          field: 'mileage',
          message: 'Active vehicle needs a positive mileage reading.',
          actionUrl: '/vehicles?record=vehicle-1',
        },
        expect.objectContaining({ id: 'delivery:delivery-1:vehicleId', severity: 'high' }),
        expect.objectContaining({ id: 'delivery:delivery-1:driver', severity: 'high' }),
        expect.objectContaining({ id: 'delivery:delivery-1:scheduledTime', severity: 'high' }),
        expect.objectContaining({ id: 'delivery:delivery-1:estimatedArrival', severity: 'high' }),
      ])
    )
    expect(result.map((issue) => issue.id)).toEqual(
      [...result.map((issue) => issue.id)].sort((a, b) => {
        const issueA = result.find((issue) => issue.id === a)!
        const issueB = result.find((issue) => issue.id === b)!
        const rank = { high: 0, medium: 1, low: 2 }
        return rank[issueA.severity] - rank[issueB.severity] || a.localeCompare(b)
      })
    )
    expect(result.every((issue) => /^\/(vehicles|deliveries|maintenance|clients)(\?|\/)/.test(issue.actionUrl))).toBe(
      true
    )
  })

  it('does not apply active-work rules to terminal or cancelled records', () => {
    const records = emptyRecords()
    records.vehicles.push({
      id: 'inactive',
      status: 'inactive',
      mileage: 0,
      driver: null,
      lastService: null,
      nextService: null,
      createdAt: new Date('2020-01-01'),
      updatedAt: new Date('2020-01-01'),
      lastUpdated: new Date('2020-01-01'),
    })
    // Driver status routes define failed, delivered and cancelled as terminal.
    for (const status of ['delivered', 'failed', 'cancelled']) {
      records.deliveries.push({
        id: status,
        status,
        vehicleId: null,
        driver: null,
        scheduledTime: null,
        estimatedArrival: null,
        contactPerson: null,
        updatedAt: new Date('2020-01-01'),
      })
    }

    expect(assessDataQuality(records, NOW)).toEqual([])
  })

  it('treats picked-up deliveries as urgent active work', () => {
    const records = emptyRecords()
    records.deliveries.push({
      id: 'picked-up',
      status: 'picked-up',
      vehicleId: null,
      driver: null,
      scheduledTime: null,
      estimatedArrival: null,
      contactPerson: null,
      updatedAt: new Date(NOW.getTime() - DATA_QUALITY_THRESHOLDS.inTransitDeliveryStaleMs - 1),
    })

    expect(assessDataQuality(records, NOW)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'delivery:picked-up:vehicleId', severity: 'high' }),
        expect.objectContaining({ id: 'delivery:picked-up:driver', severity: 'high' }),
        expect.objectContaining({ id: 'delivery:picked-up:scheduledTime', severity: 'high' }),
        expect.objectContaining({ id: 'delivery:picked-up:estimatedArrival', severity: 'high' }),
        expect.objectContaining({ id: 'delivery:picked-up:updatedAt', severity: 'high' }),
        expect.objectContaining({ id: 'delivery:picked-up:contactPerson' }),
      ])
    )
  })

  it('treats zero actual cost as recorded but flags a missing completed cost', () => {
    const records = emptyRecords()
    records.maintenance.push(
      {
        id: 'zero',
        completed: true,
        dueDate: recent,
        vehicleId: 'v1',
        costEstimate: null,
        actualCost: 0,
        updatedAt: recent,
      },
      {
        id: 'missing',
        completed: true,
        dueDate: recent,
        vehicleId: 'v1',
        costEstimate: 100,
        actualCost: null,
        updatedAt: recent,
      }
    )

    const result = assessDataQuality(records, NOW)
    expect(result).toEqual([expect.objectContaining({ id: 'maintenance:missing:actualCost', severity: 'medium' })])
  })

  it('gives a new active vehicle a seven-day grace period for default zero mileage', () => {
    const base = {
      status: 'active',
      mileage: 0,
      driver: 'Driver',
      lastService: recent,
      nextService: recent,
      updatedAt: recent,
      lastUpdated: recent,
    }
    const records = emptyRecords()
    records.vehicles.push(
      { ...base, id: 'new', createdAt: new Date(NOW.getTime() - DATA_QUALITY_THRESHOLDS.zeroMileageGraceMs) },
      { ...base, id: 'old', createdAt: new Date(NOW.getTime() - DATA_QUALITY_THRESHOLDS.zeroMileageGraceMs - 1) },
      { ...base, id: 'missing', mileage: null, createdAt: NOW },
      { ...base, id: 'negative', mileage: -1, createdAt: NOW },
      { ...base, id: 'undefined', mileage: undefined, createdAt: NOW }
    )

    const mileageIds = assessDataQuality(records, NOW)
      .filter((item) => item.field === 'mileage')
      .map((item) => item.entityId)
    expect(mileageIds).toEqual(['missing', 'negative', 'old', 'undefined'])
  })

  it('flags clients only when every usable contact method is absent', () => {
    const records = emptyRecords()
    records.clients.push(
      { id: 'none', phone: ' ', email: null, contactPerson: '{}', updatedAt: recent },
      { id: 'empty-string', phone: null, email: null, contactPerson: '""', updatedAt: recent },
      { id: 'phone', phone: '555-0100', email: null, contactPerson: null, updatedAt: recent },
      { id: 'person', phone: null, email: null, contactPerson: '{"name":"Sam"}', updatedAt: recent },
      { id: 'legacy', phone: null, email: null, contactPerson: 'Sam - dispatch', updatedAt: recent }
    )

    expect(assessDataQuality(records, NOW)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'client:none:contact', field: 'contact', actionUrl: '/clients/none' }),
        expect.objectContaining({ id: 'client:empty-string:contact' }),
      ])
    )
    expect(assessDataQuality(records, NOW)).toHaveLength(2)
  })

  it('uses documented deterministic stale thresholds for active records', () => {
    const records = emptyRecords()
    records.vehicles.push({
      id: 'stale-vehicle',
      status: 'active',
      mileage: 10,
      driver: 'Driver',
      createdAt: new Date('2020-01-01'),
      lastService: recent,
      nextService: recent,
      updatedAt: recent,
      lastUpdated: new Date(NOW.getTime() - DATA_QUALITY_THRESHOLDS.activeVehicleStaleMs - 1),
    })
    records.deliveries.push({
      id: 'stale-delivery',
      status: 'in-transit',
      vehicleId: 'v1',
      driver: 'Driver',
      scheduledTime: recent,
      estimatedArrival: recent,
      contactPerson: '{}',
      updatedAt: new Date(NOW.getTime() - DATA_QUALITY_THRESHOLDS.inTransitDeliveryStaleMs - 1),
    })
    records.maintenance.push({
      id: 'stale-maintenance',
      completed: false,
      dueDate: new Date(NOW.getTime() - 86400000),
      vehicleId: 'v1',
      costEstimate: null,
      actualCost: null,
      updatedAt: new Date(NOW.getTime() - DATA_QUALITY_THRESHOLDS.openMaintenanceStaleMs - 1),
    })

    const result = assessDataQuality(records, NOW)
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'vehicle:stale-vehicle:lastUpdated' }),
        expect.objectContaining({ id: 'delivery:stale-delivery:updatedAt' }),
        expect.objectContaining({ id: 'maintenance:stale-maintenance:updatedAt' }),
      ])
    )
  })
})
