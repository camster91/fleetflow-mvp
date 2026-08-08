export type ReviewAction = 'MAP' | 'APPROVE' | 'REJECT'

export function reviewTransition(record: { reviewStatus: string; localEntityId?: string | null }, action: ReviewAction, vehicleId?: string) {
  if (['APPLIED_MISSING_ONLY', 'CONFLICT', 'APPROVED'].includes(record.reviewStatus)) throw new Error('This record is not reviewable')
  if (action === 'MAP') {
    if (!['PENDING_REVIEW', 'NEEDS_REVIEW', 'MAPPED_PENDING_APPROVAL', 'REJECTED'].includes(record.reviewStatus)) throw new Error('This record cannot be remapped in its current state')
    if (!vehicleId) throw new Error('Vehicle mapping is required')
    return { reviewStatus: 'MAPPED_PENDING_APPROVAL', localEntityType: 'vehicle', localEntityId: vehicleId, conflictReason: null }
  }
  if (action === 'APPROVE') {
    if (!record.localEntityId || record.reviewStatus !== 'MAPPED_PENDING_APPROVAL') throw new Error('Map this record to a vehicle before approval')
    return { reviewStatus: 'APPROVED', conflictReason: null }
  }
  if (!['PENDING_REVIEW', 'NEEDS_REVIEW', 'MAPPED_PENDING_APPROVAL'].includes(record.reviewStatus)) throw new Error('This record is not reviewable')
  return { reviewStatus: 'REJECTED', conflictReason: null }
}
