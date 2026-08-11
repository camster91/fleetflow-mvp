import { enrollmentSchema, pilotEventSchema, pilotExpiry, pilotScopeKey } from '@/lib/pilot'

describe('controlled pilot contracts', () => {
  it('accepts only content-free, bounded event signals', () => {
    expect(pilotEventSchema.safeParse({ eventType: 'DASHBOARD_OPENED', sessionKey: 'A'.repeat(16) }).success).toBe(true)
    expect(pilotEventSchema.safeParse({ eventType: 'DASHBOARD_OPENED', sessionKey: 'short', prompt: 'customer content' }).success).toBe(false)
  })

  it('requires consent before activation and validates the pilot date range', () => {
    expect(enrollmentSchema.safeParse({ status: 'ACTIVE', consent: false }).success).toBe(false)
    expect(enrollmentSchema.safeParse({ status: 'ACTIVE', consent: true, pilotStartsAt: '2026-08-10T00:00:00.000Z', pilotEndsAt: '2026-08-09T00:00:00.000Z' }).success).toBe(false)
    expect(enrollmentSchema.safeParse({ status: 'ACTIVE', consent: true, supportOwnerLabel: 'Pilot support' }).success).toBe(true)
  })

  it('uses stable workspace keys and a one-year expiry', () => {
    expect(pilotScopeKey('owner', null)).toBe('owner:owner')
    expect(pilotScopeKey('owner', 'team')).toBe('team:team')
    expect(pilotExpiry(new Date('2026-01-01T00:00:00.000Z')).toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })
})
