import {
  FINDING_EVIDENCE_BYTES_MAX,
  FINDING_EVIDENCE_ITEMS_MAX,
  packFindingEvidence,
  parseStoredEvidence,
  prepareFindingWrite,
} from '@/pages/api/intelligence/findings'
import type { Finding, FindingEvidence } from '@/lib/intelligence/types'

const NOW = new Date('2026-08-08T16:00:00.000Z')

function item(index: number, value: string | number = index): FindingEvidence {
  return { entityType: 'vehicle', entityId: `v-${String(index).padStart(3, '0')}`, field: 'mileage', value, timestamp: null }
}

function finding(evidence: FindingEvidence[]): Finding {
  return {
    id: 'stable', type: 'vehicle-stale', severity: 'medium',
    confidence: { label: 'high', score: 0.9 }, score: 300,
    ruleVersion: 'fleet-ops-v1', title: 'Title', explanation: 'Explanation',
    evidence, recommendedAction: 'Review', actionUrl: '/vehicles?record=v',
    generatedAt: NOW, expiresAt: new Date('2026-08-10T00:00:00Z'),
  }
}

describe('finding evidence envelope', () => {
  it('keeps the first 100 deterministic priority items and reports the complete total', () => {
    const evidence = Array.from({ length: 105 }, (_, index) => item(index))
    const packed = packFindingEvidence(evidence)
    expect(Buffer.byteLength(packed, 'utf8')).toBeLessThanOrEqual(FINDING_EVIDENCE_BYTES_MAX)
    const parsed = parseStoredEvidence(packed)
    expect(parsed).toEqual(expect.objectContaining({
      valid: true, evidenceTotal: 105, evidenceTruncated: true,
    }))
    expect(parsed.evidence).toHaveLength(FINDING_EVIDENCE_ITEMS_MAX)
    expect(parsed.evidence[0].entityId).toBe('v-000')
    expect(parsed.evidence[99].entityId).toBe('v-099')
  })

  it('uses UTF-8 byte size and truncates valid multibyte evidence without failing refresh', () => {
    const evidence = [item(0, '\u{1F69A}'.repeat(8_000)), item(1, 'kept')]
    const packed = packFindingEvidence(evidence)
    expect(Buffer.byteLength(packed, 'utf8')).toBeLessThanOrEqual(FINDING_EVIDENCE_BYTES_MAX)
    const parsed = parseStoredEvidence(packed)
    expect(parsed.valid).toBe(true)
    expect(parsed.evidenceTotal).toBe(2)
    expect(parsed.evidenceTruncated).toBe(true)
  })

  it('accepts the exact 16KB boundary and rejects one byte over on read', () => {
    const template = { items: [item(0, '')], total: 1, truncated: false }
    const empty = JSON.stringify(template)
    const exact = JSON.stringify({
      ...template,
      items: [item(0, 'a'.repeat(FINDING_EVIDENCE_BYTES_MAX - Buffer.byteLength(empty, 'utf8')))],
    })
    expect(Buffer.byteLength(exact, 'utf8')).toBe(FINDING_EVIDENCE_BYTES_MAX)
    expect(parseStoredEvidence(exact).valid).toBe(true)
    expect(parseStoredEvidence(`${exact} `).valid).toBe(false)
  })
})

describe('finding lifecycle preparation', () => {
  it('does not extend a protected dismissal original expiry on repeated refreshes', () => {
    const originalExpiry = new Date('2026-08-09T00:00:00Z')
    const existing = {
      id: 'stable', ownerId: 'owner', teamId: null, status: 'DISMISSED',
      feedback: 'HELPFUL', ruleVersion: 'fleet-ops-v1', expiresAt: originalExpiry,
      resolvedAt: null,
    }
    const first = prepareFindingWrite(finding([item(0)]), existing, NOW)
    const second = prepareFindingWrite(
      { ...finding([item(0)]), expiresAt: new Date('2026-08-20T00:00:00Z') },
      { ...existing, expiresAt: first.expiresAt },
      new Date('2026-08-08T20:00:00Z')
    )
    expect(first.status).toBe('DISMISSED')
    expect(first.expiresAt).toEqual(originalExpiry)
    expect(second.expiresAt).toEqual(originalExpiry)
  })

  it('reopens after the original dismissal expiry and adopts the new engine expiry', () => {
    const nextExpiry = new Date('2026-08-20T00:00:00Z')
    const write = prepareFindingWrite(
      { ...finding([item(0)]), expiresAt: nextExpiry },
      {
        id: 'stable', ownerId: 'owner', teamId: null, status: 'DISMISSED',
        feedback: 'NOT_HELPFUL', ruleVersion: 'fleet-ops-v1',
        expiresAt: new Date('2026-08-09T00:00:00Z'), resolvedAt: null,
      },
      new Date('2026-08-09T00:00:00Z')
    )
    expect(write.status).toBe('OPEN')
    expect(write.expiresAt).toEqual(nextExpiry)
    expect(write.feedback).toBe('NOT_HELPFUL')
  })
})
