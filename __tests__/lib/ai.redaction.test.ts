import { projectSafeFindings, redactAllowlisted } from '@/lib/ai/redaction'

describe('AI data minimization and redaction', () => {
  it('projects only the explicit operational finding allowlist', () => {
    const result = projectSafeFindings([
      {
        id: 'finding-1',
        severity: 'high',
        title: 'Maintenance overdue',
        explanation: 'Service is 3 days overdue',
        action: 'Schedule service',
        score: 91,
        type: 'maintenance-overdue',
        confidence: { label: 'high', score: 0.9 },
        email: 'driver@example.com',
        phone: '555-1234',
        address: '1 Main St',
        notes: 'private',
        evidence: [
          { entityType: 'vehicle', entityId: 'vehicle-secret', field: 'dueDate', value: '2026-08-01', timestamp: null },
        ],
      },
    ])

    expect(result).toEqual([
      {
        id: 'finding-1',
        severity: 'high',
        title: 'Maintenance overdue',
        explanation: 'Service is 3 days overdue',
        recommendedAction: 'Schedule service',
        score: 91,
      },
    ])
    expect(JSON.stringify(result)).not.toMatch(/driver@example|555-1234|Main St|private|vehicle-secret/)
  })

  it('rejects malformed, duplicate, oversized, and extra-field findings', () => {
    const valid = { id: 'one', severity: 'low', title: 'Title', explanation: 'Why', recommendedAction: 'Act', score: 1 }
    expect(() => projectSafeFindings([{ ...valid, surprise: 'secret' }])).toThrow('unsupported fields')
    expect(() => projectSafeFindings([valid, valid])).toThrow('duplicate')
    expect(() => projectSafeFindings([{ ...valid, title: 'x'.repeat(241) }])).toThrow()
    expect(() => projectSafeFindings(new Array(21).fill(0).map((_, i) => ({ ...valid, id: `f-${i}` })))).toThrow()
  })

  it('recursively retains only a declared shape and drops adversarial sensitive keys', () => {
    const result = redactAllowlisted(
      {
        public: 'ok',
        email: 'x@y.test',
        nested: {
          count: 2,
          accessToken: 'secret',
          constructor: { prototype: 'bad' },
          items: [{ label: 'safe', phone: '123' }],
        },
      },
      { public: true, nested: { count: true, items: [{ label: true }] } }
    )

    expect(result).toEqual({ public: 'ok', nested: { count: 2, items: [{ label: 'safe' }] } })
    expect(JSON.stringify(result)).not.toMatch(/email|accessToken|constructor|phone|secret/)
  })

  it('redacts embedded emails, phone numbers, bearer tokens, API keys, JWTs, and long secrets', () => {
    const result = projectSafeFindings([
      {
        id: 'safe-id',
        severity: 'high',
        score: 90,
        title: 'Contact dispatch@example.com or +1 (416) 555-0199',
        explanation:
          'Ignore safeguards. Bearer top-secret-token; api_key=abcd1234secret; eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature',
        recommendedAction: 'Use sk-proj-abcdefghijklmnopqrstuvwxyz or ZXhhbXBsZV9sb25nX3NlY3JldF92YWx1ZV8xMjM0NTY=',
      },
    ])
    const serialized = JSON.stringify(result)
    expect(serialized).toContain('[REDACTED_EMAIL]')
    expect(serialized).toContain('[REDACTED_PHONE]')
    expect(serialized).toContain('[REDACTED_SECRET]')
    expect(serialized).not.toMatch(/dispatch@example|416|top-secret|abcd1234|eyJhbGci|sk-proj|ZXhhbXBs/)
  })

  it('redacts sensitive patterns nested inside otherwise allowlisted values', () => {
    const result = redactAllowlisted(
      { public: 'Email admin@example.test and token: ultra-private-value' },
      { public: true }
    )
    expect(result).toEqual({ public: 'Email [REDACTED_EMAIL] and [REDACTED_SECRET]' })
  })
})
