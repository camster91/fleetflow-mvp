import { reviewTransition } from '@/lib/integrations/review'

const record = {
  reviewStatus: 'PENDING_REVIEW',
  revision: 2,
  payloadHash: 'hash',
  localEntityId: null as string | null,
}

describe('integration review transitions', () => {
  it('requires a tenant vehicle to map a staged cost', () => {
    expect(() => reviewTransition(record, 'MAP', undefined)).toThrow('Vehicle mapping is required')
    expect(reviewTransition(record, 'MAP', 'vehicle-1')).toEqual({
      reviewStatus: 'MAPPED_PENDING_APPROVAL',
      localEntityType: 'vehicle',
      localEntityId: 'vehicle-1',
      conflictReason: null,
    })
  })

  it('requires mapping before approval and never creates an expense', () => {
    expect(() => reviewTransition(record, 'APPROVE')).toThrow('Map this record to a vehicle before approval')
    expect(
      reviewTransition({ ...record, reviewStatus: 'MAPPED_PENDING_APPROVAL', localEntityId: 'vehicle-1' }, 'APPROVE')
    ).toEqual({ reviewStatus: 'APPROVED', conflictReason: null })
  })

  it('supports explicit rejection but blocks an already applied geocode', () => {
    expect(reviewTransition(record, 'REJECT')).toEqual({ reviewStatus: 'REJECTED', conflictReason: null })
    expect(() => reviewTransition({ ...record, reviewStatus: 'APPLIED_MISSING_ONLY' }, 'REJECT')).toThrow(
      'This record is not reviewable'
    )
  })

  it.each(['MAPPED_PENDING_APPROVAL', 'REJECTED'])('allows an audited correction from %s', (reviewStatus) => {
    expect(reviewTransition({ ...record, reviewStatus, localEntityId: 'vehicle-old' }, 'MAP', 'vehicle-new')).toEqual({
      reviewStatus: 'MAPPED_PENDING_APPROVAL',
      localEntityType: 'vehicle',
      localEntityId: 'vehicle-new',
      conflictReason: null,
    })
  })
})
