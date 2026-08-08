/**
 * Database-independent input and output contracts for deterministic fleet
 * intelligence. Callers must pass already tenant-scoped records and an
 * explicit clock; this layer never performs I/O.
 */

export type FindingSeverity = 'high' | 'medium' | 'low'
export type FindingConfidenceLabel = 'high' | 'medium'

export type FindingType =
  | 'maintenance-overdue'
  | 'maintenance-due-soon'
  | 'maintenance-cost-concentration'
  | 'vehicle-stale'
  | 'delivery-schedule-passed'
  | 'vehicle-delivery-load'
  | 'delivery-unassigned'
  | 'data-quality-blocker'

export type EvidenceValue = string | number | boolean | null

export interface FindingEvidence {
  entityType: 'vehicle' | 'delivery' | 'maintenance' | 'client'
  entityId: string
  field: string
  value: EvidenceValue
  /** ISO timestamp for the observation, or null when the source has none. */
  timestamp: string | null
}

export interface FindingConfidence {
  /** Calibrated rule strength; it is not a predicted probability. */
  label: FindingConfidenceLabel
  /** Fixed rule calibration in [0, 1], not a prediction. */
  score: number
}

export interface Finding {
  id: string
  type: FindingType
  ruleVersion: string
  severity: FindingSeverity
  confidence: FindingConfidence
  title: string
  explanation: string
  evidence: FindingEvidence[]
  recommendedAction: string
  actionUrl: string
  generatedAt: Date
  expiresAt: Date
  /** Deterministic rank score; larger values sort first. */
  score: number
}

export interface IntelligenceVehicle {
  id: string
  status: string
  updatedAt?: Date | string | null
  lastUpdated?: Date | string | null
}

export interface IntelligenceDelivery {
  id: string
  status: string
  driver?: string | null
  vehicleId?: string | null
  scheduledTime?: Date | string | null
  updatedAt?: Date | string | null
}

export interface IntelligenceMaintenance {
  id: string
  vehicleId?: string | null
  completed: boolean
  dueDate?: Date | string | null
  completedDate?: Date | string | null
  actualCost?: number | null
  updatedAt?: Date | string | null
}

export interface IntelligenceDataQualityIssue {
  entityType: 'vehicle' | 'delivery' | 'maintenance' | 'client'
  entityId: string
  severity: FindingSeverity
  field: string
  actionUrl?: string
}

export interface IntelligenceRecords {
  vehicles?: readonly IntelligenceVehicle[] | null
  deliveries?: readonly IntelligenceDelivery[] | null
  maintenance?: readonly IntelligenceMaintenance[] | null
  dataQualityIssues?: readonly IntelligenceDataQualityIssue[] | null
}

export interface GenerateFindingsInput {
  /** Opaque, non-PII tenant identifier used only to namespace stable IDs. */
  tenantKey: string
  now: Date
  records: IntelligenceRecords
}

/** Internal shape returned by rules before the final ranker assigns score. */
export type UnrankedFinding = Omit<Finding, 'score'> & {
  /** Rule-defined urgency in [0, 100]. */
  urgency: number
}
