export const REPORT_ROW_LIMIT = 5000
export const REPORT_MAX_RANGE_MS = 366 * 86_400_000

export type ReportDateRange = { ok: true; startDate: Date; endDate: Date } | { ok: false; error: string }

function parseDate(raw: unknown, fallback: Date): Date | null {
  if (raw === undefined) return fallback
  if (typeof raw !== 'string' || !raw.trim()) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function parseReportDateRange(startRaw: unknown, endRaw: unknown, now = new Date()): ReportDateRange {
  const startDate = parseDate(startRaw, new Date(now.getTime() - 30 * 86_400_000))
  const endDate = parseDate(endRaw, now)

  if (!startDate || !endDate) {
    return { ok: false, error: 'Invalid date range' }
  }
  if (endDate < startDate) {
    return { ok: false, error: 'endDate must be on or after startDate' }
  }
  if (endDate.getTime() - startDate.getTime() > REPORT_MAX_RANGE_MS) {
    return { ok: false, error: 'Date range too large (max 366 days)' }
  }

  return { ok: true, startDate, endDate }
}
