import { parseAssistantSources, validateAnswerCitations } from '@/lib/ai/answerCitations'

describe('assistant answer citations', () => {
  const sources = [{ id: 'delivery:d1', type: 'delivery' as const, recordId: 'd1', label: 'Delivery d1', href: '/deliveries?record=d1' }]

  it('accepts claims grounded in visible internal sources', () => {
    expect(validateAnswerCitations({ claims: [{ text: 'One delivery is late.', citationIds: ['delivery:d1'] }] }, sources)).toBe(true)
  })

  it('rejects missing, unknown, duplicate, unsafe, and tampered citations', () => {
    expect(validateAnswerCitations({ claims: [{ text: 'Late.', citationIds: [] }] }, sources)).toBe(false)
    expect(validateAnswerCitations({ claims: [{ text: 'Late.', citationIds: ['delivery:other'] }] }, sources)).toBe(false)
    expect(validateAnswerCitations({ claims: [{ text: 'Late.', citationIds: ['delivery:d1', 'delivery:d1'] }] }, sources)).toBe(false)
    expect(validateAnswerCitations({ claims: [{ text: '<script>alert(1)</script>', citationIds: ['delivery:d1'] }] }, sources)).toBe(false)
  })

  it('fails closed on mismatched identity, unsafe labels, and noncanonical record links', () => {
    expect(() => parseAssistantSources([{ ...sources[0], recordId: 'other' }])).toThrow()
    expect(() => parseAssistantSources([{ ...sources[0], label: '<b>unsafe</b>' }])).toThrow()
    expect(() => parseAssistantSources([{ ...sources[0], href: '/deliveries?id=d1' }])).toThrow()
    expect(parseAssistantSources([{ id: 'client:c1', type: 'client', recordId: 'c1', label: 'Client c1', href: '/clients/c1' }])).toHaveLength(1)
    expect(parseAssistantSources([{ id: 'maintenanceAggregate:v1', type: 'maintenanceAggregate', recordId: 'v1', label: 'Maintenance total', href: '/assistant/sources/maintenance-cost?vehicle=v1' }])).toHaveLength(1)
  })
})
