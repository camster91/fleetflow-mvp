import { createPublicApiCursor, readPublicApiCursor, resolveApiCursorSecret } from '../../lib/publicApi'

describe('public API cursor security', () => {
  it('fails closed in production without a dedicated or existing strong server secret', () => {
    expect(() => resolveApiCursorSecret({ NODE_ENV: 'production' })).toThrow('API_CURSOR_SECRET is required')
    expect(() => resolveApiCursorSecret({ NODE_ENV: 'production', API_CURSOR_SECRET: 'too-short' })).toThrow(
      'at least 32 characters'
    )
  })

  it('accepts a configured dedicated secret and binds cursors to personal tenants', () => {
    const previous = process.env.API_CURSOR_SECRET
    process.env.API_CURSOR_SECRET = 'test-cursor-secret-at-least-strong-enough'
    try {
      const where = { ownerId: 'u1', teamId: null as null }
      const cursor = createPublicApiCursor('/api/v1/vehicles', where, 'vehicle-1')
      expect(readPublicApiCursor(cursor, '/api/v1/vehicles', where)).toBe('vehicle-1')
      expect(readPublicApiCursor(cursor, '/api/v1/vehicles', { ownerId: 'u2', teamId: null })).toBeNull()
    } finally {
      if (previous === undefined) delete process.env.API_CURSOR_SECRET
      else process.env.API_CURSOR_SECRET = previous
    }
  })
})
