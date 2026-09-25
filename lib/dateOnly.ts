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

/** Workspace time zone used when none is configured or the stored one is invalid. */
export const DEFAULT_TIME_ZONE = 'America/Toronto'

const IANA_ZONE_SHAPE = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/

/**
 * True when `value` is an IANA zone name the runtime's Intl data recognizes
 * (e.g. `America/Vancouver`, `UTC`). Raw offsets such as `+05:00` are rejected
 * so workspaces always follow daylight-saving rules for their region.
 */
export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) return false
  if (!IANA_ZONE_SHAPE.test(value)) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

/** The runtime's canonical spelling of a valid zone (e.g. `america/toronto` -> `America/Toronto`), else null. */
export function canonicalTimeZone(value: unknown): string | null {
  if (!isValidTimeZone(value)) return null
  return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone
}

/** The zone to use for server-side "today": the configured one, or the default. */
export function normalizeTimeZone(value: unknown): string {
  return isValidTimeZone(value) ? value : DEFAULT_TIME_ZONE
}

/** IANA zones for a time zone picker (runtime list when available). */
export function supportedTimeZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] }
  const zones = typeof intl.supportedValuesOf === 'function' ? intl.supportedValuesOf('timeZone') : []
  const list = zones.length
    ? [...zones]
    : [
        'America/St_Johns',
        'America/Halifax',
        'America/Toronto',
        'America/New_York',
        'America/Winnipeg',
        'America/Chicago',
        'America/Regina',
        'America/Edmonton',
        'America/Denver',
        'America/Phoenix',
        'America/Vancouver',
        'America/Los_Angeles',
        'America/Anchorage',
        'Pacific/Honolulu',
      ]
  if (!list.includes('UTC')) list.push('UTC')
  if (!list.includes(DEFAULT_TIME_ZONE)) list.push(DEFAULT_TIME_ZONE)
  return list
}

/**
 * The calendar day containing `now` in `timeZone`, as `YYYY-MM-DD`.
 * Server code uses this instead of the UTC day so a Vancouver fleet's "today"
 * does not roll over at 17:00 local time. Invalid zones fall back to the default.
 */
export function todayDateOnly(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: normalizeTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: 'year' | 'month' | 'day') => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

/**
 * The stored date-only value (UTC midnight) for today in `timeZone`.
 * Compare it directly with stored due dates: `dueDate < startOfTodayInZone(tz)`
 * means overdue; `dueDate >= startOfTodayInZone(tz)` means due today or later.
 */
export function startOfTodayInZone(timeZone: string, now: Date = new Date()): Date {
  return parseDateOnly(todayDateOnly(timeZone, now)) as Date
}
