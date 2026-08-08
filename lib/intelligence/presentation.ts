import type { FindingEvidence } from './types'
import { safeFindingActionUrl } from './actionUrls'
export { safeFindingActionUrl } from './actionUrls'

export const FINDING_EVIDENCE_BYTES_MAX = 16_384
export const FINDING_EVIDENCE_ITEMS_MAX = 100
const EVIDENCE_ENTITY_TYPES = new Set(['vehicle', 'delivery', 'maintenance', 'client'])
const EVIDENCE_KEYS = ['entityId', 'entityType', 'field', 'timestamp', 'value']
const STORED_STATUSES = new Set(['OPEN', 'DISMISSED', 'RESOLVED'])
const STORED_FEEDBACK = new Set(['HELPFUL', 'NOT_HELPFUL'])
const NULL_ONLY_FIELDS = new Set([
  'actualCost', 'contact', 'contactPerson', 'costEstimate', 'driver', 'estimatedArrival',
  'lastService', 'nextService', 'record', 'updatedAt',
])
const DATE_FIELDS = new Set(['dueDate', 'lastUpdated', 'scheduledTime'])
const NUMBER_FIELDS = new Set(['actualCostCents', 'mileage'])

function finitePrimitive(value: unknown): boolean {
  return value === null || typeof value === 'string' || typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
}

function validEvidenceItem(item: unknown): item is FindingEvidence {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false
  const value = item as Record<string, unknown>
  const keys = Object.keys(value).sort()
  return keys.length === EVIDENCE_KEYS.length && keys.every((key, index) => key === EVIDENCE_KEYS[index]) &&
    typeof value.entityType === 'string' && EVIDENCE_ENTITY_TYPES.has(value.entityType) &&
    typeof value.entityId === 'string' && value.entityId.length > 0 && value.entityId.length <= 128 &&
    typeof value.field === 'string' && value.field.length > 0 && value.field.length <= 128 && finitePrimitive(value.value) &&
    (value.timestamp === null || (typeof value.timestamp === 'string' && value.timestamp.length <= 64 && Number.isFinite(new Date(value.timestamp).getTime())))
}

function safeOperationalEvidence(item: FindingEvidence): boolean {
  if (NULL_ONLY_FIELDS.has(item.field)) return item.value === null
  if (DATE_FIELDS.has(item.field)) return typeof item.value === 'string' && item.value.length <= 64 && Number.isFinite(new Date(item.value).getTime())
  if (NUMBER_FIELDS.has(item.field)) return typeof item.value === 'number' && Number.isFinite(item.value) && item.value >= 0
  if (item.field === 'vehicleId') return item.value === null || (typeof item.value === 'string' && /^[\x21-\x7e]{1,128}$/.test(item.value))
  return false
}

export interface ParsedFindingEvidence {
  evidence: FindingEvidence[]
  valid: boolean
  evidenceTotal: number | null
  evidenceTruncated: boolean
}

export function parseStoredEvidence(value: unknown): ParsedFindingEvidence {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > FINDING_EVIDENCE_BYTES_MAX) return { evidence: [], valid: false, evidenceTotal: null, evidenceTruncated: true }
  try {
    const parsed: unknown = JSON.parse(value)
    let items: unknown[]
    let total: number
    let truncated: boolean
    if (Array.isArray(parsed)) {
      items = parsed; total = parsed.length; truncated = false
    } else if (parsed && typeof parsed === 'object') {
      const envelope = parsed as Record<string, unknown>
      const keys = Object.keys(envelope).sort()
      if (keys.join(',') !== 'items,total,truncated' || !Array.isArray(envelope.items) || !Number.isSafeInteger(envelope.total) || typeof envelope.truncated !== 'boolean') throw new Error('invalid')
      items = envelope.items
      total = envelope.total as number
      truncated = envelope.truncated
      if (total < items.length || truncated !== (total > items.length)) throw new Error('invalid')
    } else throw new Error('invalid')
    if (items.length > FINDING_EVIDENCE_ITEMS_MAX || !items.every(validEvidenceItem)) throw new Error('invalid')
    return { evidence: items as FindingEvidence[], valid: true, evidenceTotal: total, evidenceTruncated: truncated }
  } catch {
    return { evidence: [], valid: false, evidenceTotal: null, evidenceTruncated: true }
  }
}

export function packFindingEvidence(evidence: readonly FindingEvidence[]): string {
  const valid = evidence.filter(validEvidenceItem)
  const items: FindingEvidence[] = []
  for (const item of valid) {
    if (items.length >= FINDING_EVIDENCE_ITEMS_MAX) break
    const candidate = [...items, item]
    const encoded = JSON.stringify({ items: candidate, total: valid.length, truncated: candidate.length < valid.length })
    if (Buffer.byteLength(encoded, 'utf8') <= FINDING_EVIDENCE_BYTES_MAX) items.push(item)
  }
  return JSON.stringify({ items, total: valid.length, truncated: items.length < valid.length })
}

export function presentStoredFinding(row: Record<string, unknown>, now = new Date()) {
  const parsed = parseStoredEvidence(row.evidence)
  const safeEvidence = parsed.evidence.filter(safeOperationalEvidence)
  const redacted = safeEvidence.length !== parsed.evidence.length
  const expiresAt = row.expiresAt instanceof Date ? row.expiresAt : null
  const statusValid = typeof row.status === 'string' && STORED_STATUSES.has(row.status)
  const status = statusValid ? row.status : 'UNKNOWN'
  const feedbackValid = row.feedback === null || (typeof row.feedback === 'string' && STORED_FEEDBACK.has(row.feedback))
  const expired = status === 'OPEN' && expiresAt !== null && expiresAt.getTime() <= now.getTime()
  return {
    id: row.id, type: row.type, severity: row.severity, confidence: row.confidence,
    score: row.score, ruleVersion: row.ruleVersion, title: row.title,
    explanation: row.explanation, action: row.action,
    actionUrl: safeFindingActionUrl(row.actionUrl), status, statusValid,
    feedback: feedbackValid ? row.feedback : null, feedbackValid,
    generatedAt: row.generatedAt, expiresAt: row.expiresAt, resolvedAt: row.resolvedAt,
    evidence: safeEvidence, evidenceValid: parsed.valid && !redacted,
    evidenceTotal: redacted ? null : parsed.evidenceTotal,
    evidenceTruncated: parsed.evidenceTruncated || redacted, expired, effectiveStatus: expired ? 'EXPIRED' : status,
  }
}
