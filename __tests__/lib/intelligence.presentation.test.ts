import { presentStoredFinding, safeFindingActionUrl } from '@/lib/intelligence/presentation'

const base = {
  id: 'f', type: 'data-quality-blocker', severity: 'high', confidence: 1, score: 500,
  ruleVersion: 'v1', title: 'Review', explanation: 'Review record', action: 'Review',
  status: 'OPEN', feedback: null, generatedAt: new Date('2026-08-08T16:00:00Z'),
  expiresAt: null, resolvedAt: null,
}

describe('intelligence presentation boundary', () => {
  it.each([
    ['/clients/client%2Fone', '/clients/client%2Fone'],
    ['/vehicles?record=v%2F1', '/vehicles?record=v%2F1'],
    ['/deliveries?record=d-1', '/deliveries?record=d-1'],
    ['/maintenance?record=m-1', '/maintenance?record=m-1'],
    ['/clients?record=c-1', null], ['/clients/c-1/notes', null], ['/vehicles/v-1', null],
    ['//evil.example/vehicles?record=x', null], ['/settings?record=x', null],
  ])('canonicalizes safe internal URL %s', (value, expected) => {
    expect(safeFindingActionUrl(value)).toBe(expected)
  })

  it('redacts schema-valid legacy PII and unknown strings without exposing raw JSON', () => {
    const presented = presentStoredFinding({ ...base, actionUrl: '/clients/client%2Fone', evidence: JSON.stringify({
      items: [
        { entityType: 'client', entityId: 'c-1', field: 'email', value: 'private@example.test', timestamp: null },
        { entityType: 'delivery', entityId: 'd-1', field: 'notes', value: 'gate code 1234', timestamp: null },
        { entityType: 'vehicle', entityId: 'v-1', field: 'mileage', value: 1200, timestamp: null },
      ], total: 3, truncated: false,
    }) })
    expect(presented.evidence).toEqual([{ entityType: 'vehicle', entityId: 'v-1', field: 'mileage', value: 1200, timestamp: null }])
    expect(presented.evidenceValid).toBe(false)
    expect(presented.evidenceTruncated).toBe(true)
    expect(JSON.stringify(presented)).not.toMatch(/private@example|gate code|"email"|"notes"/)
  })
})
