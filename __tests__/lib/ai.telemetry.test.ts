import { aggregateAiTelemetry, parseAiTelemetryEvent, telemetryRetentionCutoff } from '@/lib/ai/telemetry'

describe('AI telemetry privacy and bounds', () => {
  test('accepts bounded metadata and aggregates without raw content or identifiers', () => {
    const first = parseAiTelemetryEvent({ provider: 'openai', modelVersion: 'gpt-safe@2026-08', status: 'generated', latencyMs: 120, inputTokens: 10, outputTokens: 4, occurredAt: '2026-08-08T12:00:00.000Z' })
    const second = parseAiTelemetryEvent({ provider: 'openai', modelVersion: 'gpt-safe@2026-08', status: 'fallback', errorCode: 'timeout', latencyMs: 280, inputTokens: null, outputTokens: null, occurredAt: '2026-08-08T12:01:00.000Z' })
    expect(aggregateAiTelemetry([first, second])).toEqual(expect.objectContaining({ requests: 2, generated: 1, fallbacks: 1, errors: 1, averageLatencyMs: 200, inputTokens: 10, outputTokens: 4 }))
    expect(JSON.stringify(first)).not.toMatch(/prompt|question|userId|teamId|requestId/i)
  })

  test.each([
    { provider: 'openai', modelVersion: 'x', status: 'generated', latencyMs: -1, occurredAt: '2026-08-08T12:00:00Z' },
    { provider: 'x'.repeat(40), modelVersion: 'x', status: 'generated', latencyMs: 1, occurredAt: '2026-08-08T12:00:00Z' },
    { provider: 'openai', modelVersion: 'x', status: 'generated', latencyMs: 1, prompt: 'private', occurredAt: '2026-08-08T12:00:00Z' },
  ])('rejects malformed, high-cardinality, or content-bearing telemetry %#', value => {
    expect(() => parseAiTelemetryEvent(value)).toThrow()
  })

  test('clamps retention to conservative bounds', () => {
    const now = new Date('2026-08-08T00:00:00Z')
    expect(telemetryRetentionCutoff(now, 1).toISOString()).toBe('2026-08-01T00:00:00.000Z')
    expect(telemetryRetentionCutoff(now, 999).toISOString()).toBe('2026-05-10T00:00:00.000Z')
  })
})
