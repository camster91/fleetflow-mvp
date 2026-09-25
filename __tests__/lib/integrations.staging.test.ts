import { nextStagedRecord } from '@/lib/integrations/staging'

describe('integration staged record conflict rules', () => {
  const existing = { payloadHash: 'old', reviewStatus: 'APPROVED', revision: 3 }

  it('does not change review state for a duplicate upstream record', () => {
    expect(nextStagedRecord(existing, 'old')).toEqual({
      changed: false,
      revision: 3,
      reviewStatus: 'APPROVED',
      conflictReason: null,
    })
  })

  it('invalidates approval and increments revision when upstream content changes', () => {
    expect(nextStagedRecord(existing, 'new')).toEqual({
      changed: true,
      revision: 4,
      reviewStatus: 'NEEDS_REVIEW',
      conflictReason: 'Provider record changed after prior review',
    })
  })

  it('keeps an unreviewed update pending without inventing an approval conflict', () => {
    expect(nextStagedRecord({ payloadHash: 'old', reviewStatus: 'PENDING_REVIEW', revision: 1 }, 'new')).toEqual({
      changed: true,
      revision: 2,
      reviewStatus: 'NEEDS_REVIEW',
      conflictReason: 'Provider record changed before review',
    })
  })
})
