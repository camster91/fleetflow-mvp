import { generateFindings } from '@/lib/intelligence/generateFindings'
import { MAX_FINDING_ID_LENGTH } from '@/lib/intelligence/rules'

const NOW = new Date('2026-08-08T16:00:00.000Z')

describe('generateFindings integration', () => {
  it('is reproducible for an injected clock, produces unique stable IDs, and separates tenants', () => {
    const records = {
      vehicles: [{ id: 'v:1', status: 'active', lastUpdated: new Date('2026-07-01T00:00:00Z') }],
      deliveries: [
        {
          id: 'd:1',
          status: 'pending',
          driver: null,
          vehicleId: null,
          scheduledTime: new Date('2026-08-08T12:00:00Z'),
        },
      ],
      maintenance: [{ id: 'm:1', completed: false, dueDate: new Date('2026-08-01T00:00:00Z') }],
      dataQualityIssues: [
        { entityType: 'vehicle' as const, entityId: 'v:1', field: 'mileage', severity: 'high' as const },
        { entityType: 'vehicle' as const, entityId: 'v:1', field: 'mileage', severity: 'high' as const },
      ],
    }
    const first = generateFindings({ tenantKey: 'tenant:a', now: NOW, records })
    const second = generateFindings({ tenantKey: 'tenant:a', now: NOW, records })
    const otherTenant = generateFindings({ tenantKey: 'tenant:b', now: NOW, records })

    expect(first).toEqual(second)
    expect(new Set(first.map((finding) => finding.id)).size).toBe(first.length)
    expect(otherTenant.map((finding) => finding.id)).not.toEqual(first.map((finding) => finding.id))
    expect(first.map((finding) => finding.score)).toEqual(
      [...first].map((finding) => finding.score).sort((a, b) => b - a)
    )
    expect(first.every((finding) => finding.generatedAt.toISOString() === NOW.toISOString())).toBe(true)
    expect(first.every((finding) => finding.id.length <= MAX_FINDING_ID_LENGTH)).toBe(true)
  })

  it('handles malformed record values without throwing or leaking unsafe fields', () => {
    const findings = generateFindings({
      tenantKey: 'tenant',
      now: NOW,
      records: {
        vehicles: [null, { id: '', status: 'active', updatedAt: 'bad' }] as never,
        deliveries: [null, { id: 'd', status: 42, scheduledTime: 'bad' }] as never,
        maintenance: [
          null,
          { id: 'm', completed: true, vehicleId: 'v', actualCost: Number.NaN, completedDate: 'bad' },
        ] as never,
        dataQualityIssues: [
          null,
          { entityType: 'vehicle', entityId: 'v', field: 'apiKey=secret', severity: 'high' },
        ] as never,
      },
    })
    expect(findings).toHaveLength(1)
    expect(JSON.stringify(findings)).not.toContain('apiKey=secret')
  })

  it('rejects missing tenant identity, records, and invalid dates', () => {
    expect(() => generateFindings({ tenantKey: '', now: NOW, records: {} })).toThrow('tenantKey')
    expect(() => generateFindings({ tenantKey: 'x'.repeat(129), now: NOW, records: {} })).toThrow('1-128')
    expect(() => generateFindings({ tenantKey: ' padded', now: NOW, records: {} })).toThrow('tenantKey')
    expect(() => generateFindings({ tenantKey: 't', now: new Date('bad'), records: {} })).toThrow('now')
    expect(() => generateFindings({ tenantKey: 't', now: NOW, records: null as never })).toThrow('records')
  })

  it('uses absolute instants consistently across timezone-offset inputs', () => {
    const records = {
      maintenance: [
        {
          id: 'm',
          completed: false,
          dueDate: '2026-08-08T11:59:59-04:00',
        },
      ],
    }
    const utc = generateFindings({ tenantKey: 't', now: new Date('2026-08-08T16:00:00Z'), records })
    const offset = generateFindings({ tenantKey: 't', now: new Date('2026-08-08T12:00:00-04:00'), records })
    expect(offset).toEqual(utc)
    expect(utc[0].type).toBe('maintenance-overdue')
  })

  it('processes a large bounded input deterministically', () => {
    const deliveries = Array.from({ length: 5_000 }, (_, index) => ({
      id: `d-${index}`,
      status: index % 2 ? 'pending' : 'delivered',
      driver: index % 2 ? 'assigned' : null,
      vehicleId: `v-${index % 100}`,
      scheduledTime: new Date(NOW.getTime() + 60_000),
    }))
    const started = performance.now()
    const findings = generateFindings({ tenantKey: 'large', now: NOW, records: { deliveries } })
    expect(performance.now() - started).toBeLessThan(2_000)
    expect(findings).toHaveLength(50)
    expect(new Set(findings.map((finding) => finding.id)).size).toBe(50)
  })
})
