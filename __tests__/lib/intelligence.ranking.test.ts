import { evidenceCompleteness, rankFindings } from '@/lib/intelligence/generateFindings'
import type { UnrankedFinding } from '@/lib/intelligence/types'

const NOW = new Date('2026-08-08T16:00:00.000Z')

function finding(id: string, severity: UnrankedFinding['severity'], urgency: number, evidence = true): UnrankedFinding {
  return {
    id,
    type: 'vehicle-stale',
    ruleVersion: 'test-v1',
    severity,
    confidence: { label: 'high', score: 1 },
    title: id,
    explanation: id,
    evidence: evidence
      ? [{ entityType: 'vehicle', entityId: id, field: 'updatedAt', value: null, timestamp: null }]
      : [],
    recommendedAction: 'Review.',
    actionUrl: `/vehicles?record=${id}`,
    generatedAt: NOW,
    expiresAt: new Date(NOW.getTime() + 1000),
    urgency,
  }
}

describe('finding ranker', () => {
  it('orders by severity, then urgency/evidence, then stable ID', () => {
    const ranked = rankFindings([
      finding('medium', 'medium', 100),
      finding('high-b', 'high', 1),
      finding('high-a', 'high', 1),
      finding('low', 'low', 100),
    ])
    expect(ranked.map((item) => item.id)).toEqual(['high-a', 'high-b', 'medium', 'low'])
    expect(ranked.every((item) => Number.isInteger(item.score))).toBe(true)
  })

  it('clamps urgency and gives complete evidence a bounded 20-point weight', () => {
    expect(evidenceCompleteness([])).toBe(0)
    expect(evidenceCompleteness(finding('x', 'low', 0).evidence)).toBe(20)
    const [ranked] = rankFindings([finding('x', 'low', 999)])
    expect(ranked.score).toBe(220)
  })

  it.each([
    [Number.NaN, 120],
    [Number.POSITIVE_INFINITY, 120],
    [Number.NEGATIVE_INFINITY, 120],
    [-50, 120],
  ])('normalizes urgency %p to a finite bounded score', (urgency, expectedScore) => {
    const [ranked] = rankFindings([finding('x', 'low', urgency)])
    expect(ranked.score).toBe(expectedScore)
    expect(Number.isFinite(ranked.score)).toBe(true)
  })

  it('normalizes non-finite evidence and confidence numbers', () => {
    const invalid = finding('x', 'low', 0)
    invalid.evidence[0].value = Number.NaN
    invalid.confidence.score = Number.POSITIVE_INFINITY
    const [ranked] = rankFindings([invalid])
    expect(ranked.evidence[0].value).toBeNull()
    expect(ranked.confidence.score).toBe(0)
    expect(ranked.score).toBe(120)
  })
})
