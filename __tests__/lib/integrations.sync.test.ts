import { fetchJsonBounded, nextBackoffMs, ProviderHttpError, safeRemoteId, syncIdempotencyKey } from '@/lib/integrations/sync'

describe('integration sync safety', () => {
  it('uses stable idempotency markers and bounded retry backoff', () => {
    expect(syncIdempotencyKey('quickbooks', 'cursor-1', 'request-1')).toBe(syncIdempotencyKey('quickbooks', 'cursor-1', 'request-1'))
    expect(syncIdempotencyKey('quickbooks', 'cursor-1', 'request-1')).not.toBe(syncIdempotencyKey('quickbooks', 'cursor-2', 'request-1'))
    expect([0, 1, 2, 20].map(nextBackoffMs)).toEqual([250, 500, 1000, 8000])
  })

  it('rejects missing or oversized provider record ids', () => {
    expect(safeRemoteId('  bill-1 ')).toBe('bill-1')
    expect(() => safeRemoteId('')).toThrow('Invalid provider record id')
    expect(() => safeRemoteId('x'.repeat(257))).toThrow('Invalid provider record id')
  })

  it('retries provider downtime and returns the bounded JSON response', async () => {
    const originalFetch = global.fetch
    global.fetch = jest.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200, headers: { 'content-length': '11' } })) as jest.Mock
    try {
      await expect(fetchJsonBounded('https://quickbooks.api.intuit.com/test', {}, 100, 2)).resolves.toEqual({ ok: true })
      expect(global.fetch).toHaveBeenCalledTimes(2)
    } finally { global.fetch = originalFetch }
  })

  it('rejects an oversized chunked response even without Content-Length', async () => {
    const originalFetch = global.fetch
    global.fetch = jest.fn().mockResolvedValue(new Response('x'.repeat(101), { status: 200 })) as jest.Mock
    try {
      await expect(fetchJsonBounded('https://maps.googleapis.com/test', {}, 100, 1)).rejects.toThrow('provider response too large')
    } finally { global.fetch = originalFetch }
  })

  it('classifies invalid_grant without exposing the provider response', async () => {
    const originalFetch = global.fetch
    global.fetch = jest.fn().mockResolvedValue(new Response('{"error":"invalid_grant","error_description":"sensitive"}', { status: 400 })) as jest.Mock
    try {
      await expect(fetchJsonBounded('https://oauth.platform.intuit.com/token', {}, 1000, 1)).rejects.toEqual(expect.objectContaining<Partial<ProviderHttpError>>({ status: 400, providerCode: 'invalid_grant' }))
    } finally { global.fetch = originalFetch }
  })
})
