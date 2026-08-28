import {
  parseActivityFilters,
  parseAuditMetadata,
  parseSearchTerm,
} from '@/lib/readQuery'

describe('bounded read query parsing', () => {
  it.each([
    [undefined, { ok: true, value: null }],
    ['', { ok: true, value: null }],
    [' a ', { ok: true, value: null }],
    [' truck 42 ', { ok: true, value: 'truck 42' }],
    [['truck'], { ok: false, error: 'Invalid search query' }],
    ['x'.repeat(101), { ok: false, error: 'Search query is too long' }],
  ])('parses search query %p', (raw, expected) => {
    expect(parseSearchTerm(raw)).toEqual(expected)
  })

  it('defaults activity filters safely', () => {
    expect(parseActivityFilters(undefined, undefined)).toEqual({
      ok: true,
      value: { limit: 20 },
    })
  })

  it.each([
    ['0', undefined, 'Activity limit must be between 1 and 100'],
    ['101', undefined, 'Activity limit must be between 1 and 100'],
    ['1.5', undefined, 'Invalid activity limit'],
    [['20'], undefined, 'Invalid activity limit'],
    ['20', ['vehicle'], 'Invalid activity type'],
    ['20', 'vehicle type', 'Invalid activity type'],
    ['20', 'x'.repeat(65), 'Invalid activity type'],
  ])('rejects activity filters %p and %p', (limit, type, error) => {
    expect(parseActivityFilters(limit, type)).toEqual({ ok: false, error })
  })

  it('accepts bounded activity filters', () => {
    expect(parseActivityFilters('100', 'maintenance_task')).toEqual({
      ok: true,
      value: { limit: 100, entityType: 'maintenance_task' },
    })
  })

  it('does not let one malformed legacy metadata row crash the feed', () => {
    expect(parseAuditMetadata('{"documentId":"doc-1"}')).toEqual({
      documentId: 'doc-1',
    })
    expect(parseAuditMetadata('{broken')).toBeUndefined()
    expect(parseAuditMetadata('["not", "a", "record"]')).toBeUndefined()
    expect(parseAuditMetadata('true')).toBeUndefined()
    expect(parseAuditMetadata(null)).toBeUndefined()
  })
})
