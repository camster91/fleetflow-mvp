import { integrationRatePolicy, rateBucket } from '@/lib/integrations/rateLimit'

describe('durable integration rate policies', () => {
  it('uses bounded action-specific policies', () => {
    expect(integrationRatePolicy('connect')).toEqual({ limit: 10, windowMs: 300000 })
    expect(integrationRatePolicy('callback')).toEqual({ limit: 20, windowMs: 300000 })
    expect(integrationRatePolicy('sync')).toEqual({ limit: 30, windowMs: 3600000 })
    expect(integrationRatePolicy('review')).toEqual({ limit: 60, windowMs: 60000 })
  })
  it('creates deterministic UTC buckets', () => expect(rateBucket(new Date('2026-08-08T12:03:12.345Z'), 300000).toISOString()).toBe('2026-08-08T12:00:00.000Z'))
})
