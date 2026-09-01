import {
  parseReportDateRange,
  REPORT_MAX_RANGE_MS,
  REPORT_ROW_LIMIT,
} from '@/lib/reporting'

describe('report query bounds', () => {
  const now = new Date('2026-08-28T12:00:00.000Z')

  it('defaults to the trailing 30 days', () => {
    const result = parseReportDateRange(undefined, undefined, now)

    expect(result).toEqual({
      ok: true,
      startDate: new Date('2026-07-29T12:00:00.000Z'),
      endDate: now,
    })
  })

  it.each([
    ['not-a-date', undefined, 'Invalid date range'],
    [undefined, ['2026-08-28'], 'Invalid date range'],
    ['2026-08-29', '2026-08-28', 'endDate must be on or after startDate'],
    ['2025-01-01', '2026-08-28', 'Date range too large (max 366 days)'],
  ])('rejects unsafe range %p to %p', (start, end, error) => {
    expect(parseReportDateRange(start, end, now)).toEqual({ ok: false, error })
  })

  it('accepts the maximum bounded range', () => {
    const endDate = new Date('2026-08-28T12:00:00.000Z')
    const startDate = new Date(endDate.getTime() - REPORT_MAX_RANGE_MS)

    expect(parseReportDateRange(startDate.toISOString(), endDate.toISOString(), now))
      .toEqual({ ok: true, startDate, endDate })
  })

  it('keeps in-memory report materialization explicitly capped', () => {
    expect(REPORT_ROW_LIMIT).toBe(5000)
  })
})
