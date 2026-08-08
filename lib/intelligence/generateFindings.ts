import { FINDING_RULES, isValidOpaqueId, MAX_OPAQUE_ID_LENGTH } from './rules'
import type { Finding, FindingEvidence, GenerateFindingsInput, UnrankedFinding } from './types'

// Each severity band is wider than the maximum urgency + evidence contribution
// (120), so a lower-severity finding can never outrank a higher-severity one.
const SEVERITY_WEIGHT = Object.freeze({ high: 400, medium: 250, low: 100 })

function compareStable(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function validEvidenceField(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0
}

/**
 * Evidence completeness contributes at most 20 points: an evidence list is
 * worth 5, and entity type, opaque ID, field, and the presence of a value and
 * timestamp contribute the remaining 15 proportionally. Null is a deliberate
 * value for missing-data evidence and therefore counts as present.
 */
export function evidenceCompleteness(evidence: readonly FindingEvidence[]): number {
  if (evidence.length === 0) return 0
  let complete = 0
  for (const item of evidence) {
    complete += Number(validEvidenceField(item.entityType))
    complete += Number(validEvidenceField(item.entityId))
    complete += Number(validEvidenceField(item.field))
    complete += Number(Object.prototype.hasOwnProperty.call(item, 'value'))
    complete += Number(Object.prototype.hasOwnProperty.call(item, 'timestamp'))
  }
  return 5 + Math.round((complete / (evidence.length * 5)) * 15)
}

/** Severity (100/250/400) dominates urgency (0..100), then evidence (0..20). */
export function rankFinding(finding: UnrankedFinding): Finding {
  const rawUrgency = Number.isFinite(finding.urgency) ? finding.urgency : 0
  const urgency = Math.max(0, Math.min(100, Math.round(rawUrgency)))
  const evidence = finding.evidence.map(item => ({
    ...item,
    value: typeof item.value === 'number' && !Number.isFinite(item.value) ? null : item.value,
  }))
  const rawConfidence = Number.isFinite(finding.confidence.score) ? finding.confidence.score : 0
  const confidence = { ...finding.confidence, score: Math.max(0, Math.min(1, rawConfidence)) }
  const severityWeight = SEVERITY_WEIGHT[finding.severity] ?? SEVERITY_WEIGHT.low
  const score = severityWeight + urgency + evidenceCompleteness(evidence)
  const { urgency: _urgency, ...rest } = finding
  return { ...rest, confidence, evidence, score }
}

export function rankFindings(findings: readonly UnrankedFinding[]): Finding[] {
  return findings
    .map(rankFinding)
    .sort((a, b) => b.score - a.score || compareStable(a.id, b.id))
}

/** Generate reproducible findings from already tenant-scoped records. */
export function generateFindings(input: GenerateFindingsInput): Finding[] {
  if (!input || !isValidOpaqueId(input.tenantKey)) {
    throw new TypeError(`tenantKey must be an opaque identifier of 1-${MAX_OPAQUE_ID_LENGTH} visible ASCII characters`)
  }
  if (!(input.now instanceof Date) || !Number.isFinite(input.now.getTime())) {
    throw new TypeError('now must be a valid Date')
  }
  if (!input.records || typeof input.records !== 'object') {
    throw new TypeError('records must be provided')
  }

  const generated = FINDING_RULES.flatMap(rule => rule(input))
  const unique = new Map<string, UnrankedFinding>()
  for (const finding of generated) {
    const current = unique.get(finding.id)
    if (!current || rankFinding(finding).score > rankFinding(current).score) unique.set(finding.id, finding)
  }
  return rankFindings([...unique.values()])
}

export type {
  Finding, FindingConfidence, FindingEvidence, FindingSeverity, FindingType,
  GenerateFindingsInput, IntelligenceDataQualityIssue, IntelligenceDelivery,
  IntelligenceMaintenance, IntelligenceRecords, IntelligenceVehicle,
} from './types'
