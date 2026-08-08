import { integrationRetentionCutoffs } from '@/lib/integrations/retention'

describe('integration retention policy', () => {
  it('uses fixed bounded windows for quota, OAuth, jobs, and staged PII decisions', () => {
    const cutoffs = integrationRetentionCutoffs(new Date('2026-08-08T12:00:00.000Z'))
    expect(cutoffs.rateLimits.toISOString()).toBe('2026-08-06T12:00:00.000Z')
    expect(cutoffs.oauthStates.toISOString()).toBe('2026-08-07T12:00:00.000Z')
    expect(cutoffs.syncJobs.toISOString()).toBe('2026-05-10T12:00:00.000Z')
    expect(cutoffs.stagedRecords.toISOString()).toBe('2025-08-08T12:00:00.000Z')
  })
})
