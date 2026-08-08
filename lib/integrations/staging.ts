import type { Prisma } from '@prisma/client'

export function nextStagedRecord(existing: { payloadHash: string; reviewStatus: string; revision: number }, nextHash: string) {
  if (existing.payloadHash === nextHash) return { changed: false, revision: existing.revision, reviewStatus: existing.reviewStatus, conflictReason: null }
  const reviewed = ['APPROVED', 'REJECTED', 'MAPPED_PENDING_APPROVAL'].includes(existing.reviewStatus)
  return {
    changed: true,
    revision: existing.revision + 1,
    reviewStatus: 'NEEDS_REVIEW',
    conflictReason: reviewed ? 'Provider record changed after prior review' : 'Provider record changed before review',
  }
}

export interface StageRecordInput {
  connectionId: string; remoteType: string; remoteId: string; payloadHash: string; reviewPayload: string
  provenance: string; remoteUpdatedAt?: Date | null; localEntityType?: string; localEntityId?: string
  initialStatus?: string; initialConflictReason?: string | null
}

type IntegrationTx = Prisma.TransactionClient

export async function stageIntegrationRecord(tx: IntegrationTx, input: StageRecordInput) {
  const key = { connectionId: input.connectionId, remoteType: input.remoteType, remoteId: input.remoteId }
  const existing = await tx.integrationRecord.findUnique({ where: { connectionId_remoteType_remoteId: key } })
  if (!existing) return tx.integrationRecord.create({ data: {
    connectionId: input.connectionId, remoteType: input.remoteType, remoteId: input.remoteId,
    payloadHash: input.payloadHash, reviewPayload: input.reviewPayload, provenance: input.provenance,
    remoteUpdatedAt: input.remoteUpdatedAt, localEntityType: input.localEntityType, localEntityId: input.localEntityId,
    reviewStatus: input.initialStatus || 'PENDING_REVIEW', conflictReason: input.initialConflictReason ?? null,
  } })
  const transition = nextStagedRecord(existing, input.payloadHash)
  return tx.integrationRecord.update({ where: { id: existing.id }, data: transition.changed ? {
    payloadHash: input.payloadHash, reviewPayload: input.reviewPayload, provenance: input.provenance,
    remoteUpdatedAt: input.remoteUpdatedAt, lastSeenAt: new Date(), revision: transition.revision,
    reviewStatus: transition.reviewStatus, conflictReason: transition.conflictReason,
    localEntityType: null, localEntityId: null,
  } : { lastSeenAt: new Date(), provenance: input.provenance } })
}
