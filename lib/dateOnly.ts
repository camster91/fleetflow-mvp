import { format } from 'date-fns'

/**
 * Date-only values (due dates, completion dates, service dates) are calendar
 * days with no time of day. They are stored in `DateTime` columns at
 * **UTC midnight** (`YYYY-MM-DDT00:00:00.000Z`) and read back with UTC
 * accessors, so the stored day never depends on the server or browser zone.
 */

const DATE_ONLY_PREFIX = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/

/**
 * Parse a `YYYY-MM-DD` string (a trailing ISO time part is ignored) into the
 * canonical UTC-midnight Date. Date inputs are normalized to their UTC day.
 * Returns null for empty or invalid values.
 */
export function parseDateOnly(value: string | Date | null | undefined): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
  }
  const match = DATE_ONLY_PREFIX.exec(value)
  if (!match) return null
  const [, y, m, d] = match
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
  // Reject rolled-over dates such as 2026-02-30.
  if (date.getUTCFullYear() !== Number(y) || date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) {
    return null
  }
  return date
}

/** Format a stored date-only value (UTC midnight) as `YYYY-MM-DD`. */
export function toDateOnly(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined
  if (typeof value === 'string') {
    const match = DATE_ONLY_PREFIX.exec(value)
    return match ? `${match[1]}-${match[2]}-${match[3]}` : undefined
  }
  if (Number.isNaN(value.getTime())) return undefined
  return value.toISOString().slice(0, 10)
}

/**
 * The calendar day of `date` in the *local* time zone as `YYYY-MM-DD`.
 * Use this in the browser for "today" / "next week" defaults instead of
 * `toISOString()`, which reports the UTC day and shifts west of UTC.
 */
export function localDateOnly(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd')
}

/** UTC midnight at the start of the UTC day containing `now`. */
export function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}
