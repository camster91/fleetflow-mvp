/**
 * Server-side pagination, search, filtering and sorting for the list routes
 * (vehicles, deliveries, maintenance, clients).
 *
 * Every option is allow-listed per route: search runs over fixed text columns,
 * filters accept only known values, and sorting accepts only known keys. The
 * unique `id` column is always appended to `orderBy` so offset pagination is
 * deterministic. Search and filters are ANDed onto the caller's tenant/driver
 * scope, never replacing it.
 */

export type SortOrder = 'asc' | 'desc'
type Where = Record<string, unknown>
type Query = Record<string, string | string[] | undefined>

export interface ListFilterSpec {
  /** Accepted values; `all` (or an empty value) always means "no filter". */
  values: readonly string[]
  where: (value: string, context: ListFilterContext) => Where
}

export interface ListFilterContext {
  /** Start of "today" (UTC midnight of the caller's calendar day). */
  today: Date
}

export interface ListQuerySpec {
  /** Text search: each entry builds the condition for one field. */
  search: ReadonlyArray<(q: string) => Where>
  filters?: Record<string, ListFilterSpec>
  /** Sort key -> nullable column? The key is the Prisma field name. */
  sorts: Record<string, { field: string; nullable?: boolean; defaultOrder?: SortOrder }>
  /** Ordering used when no `sort` is given (id is appended automatically). */
  defaultSort: { field: string; order: SortOrder }
}

export interface ParsedListQuery {
  page: number
  limit: number
  skip: number
  /** Extra conditions to AND with the scoped where; empty when unfiltered. */
  conditions: Where[]
  orderBy: Array<Record<string, unknown>>
  summary: boolean
  today: Date
}

export const LIST_MAX_LIMIT = 200
export const LIST_DEFAULT_LIMIT = 50
export const LIST_MAX_SEARCH_LENGTH = 100

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

const single = (raw: string | string[] | undefined): string | undefined | null => (Array.isArray(raw) ? null : raw)

/** Case-insensitive `contains` condition for a string column. */
export const containsInsensitive =
  (field: string) =>
  (q: string): Where => ({
    [field]: { contains: q, mode: 'insensitive' },
  })

/** Parse a `YYYY-MM-DD` calendar day into UTC midnight, or null. */
function parseDay(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null
}

export function parseListQuery(query: Query, spec: ListQuerySpec, now: Date = new Date()): Parsed<ParsedListQuery> {
  // page/limit keep their historical lenient parsing for existing callers.
  const page = Math.max(1, parseInt(single(query.page) ?? '', 10) || 1)
  const limit = Math.min(LIST_MAX_LIMIT, Math.max(1, parseInt(single(query.limit) ?? '', 10) || LIST_DEFAULT_LIMIT))
  const skip = (page - 1) * limit

  let today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const rawToday = single(query.today)
  if (rawToday === null) return { ok: false, error: 'Invalid today' }
  if (rawToday !== undefined && rawToday !== '') {
    const parsed = parseDay(rawToday)
    if (!parsed) return { ok: false, error: 'Invalid today' }
    today = parsed
  }

  const conditions: Where[] = []
  const rawQ = single(query.q)
  if (rawQ === null) return { ok: false, error: 'Invalid search query' }
  const q = (rawQ ?? '').trim()
  if (q.length > LIST_MAX_SEARCH_LENGTH) return { ok: false, error: 'Search query is too long' }
  if (q) conditions.push({ OR: spec.search.map((field) => field(q)) })

  for (const [key, filter] of Object.entries(spec.filters ?? {})) {
    const raw = single(query[key])
    if (raw === null) return { ok: false, error: `Invalid ${key} filter` }
    if (raw === undefined || raw === '' || raw === 'all') continue
    if (!filter.values.includes(raw)) return { ok: false, error: `Invalid ${key} filter` }
    conditions.push(filter.where(raw, { today }))
  }

  const rawSort = single(query.sort)
  const rawOrder = single(query.order)
  if (
    rawSort === null ||
    (rawSort !== undefined && rawSort !== '' && !Object.prototype.hasOwnProperty.call(spec.sorts, rawSort))
  ) {
    return { ok: false, error: 'Invalid sort' }
  }
  if (rawOrder === null || (rawOrder !== undefined && rawOrder !== '' && rawOrder !== 'asc' && rawOrder !== 'desc')) {
    return { ok: false, error: 'Invalid sort order' }
  }
  let orderBy: Array<Record<string, unknown>>
  if (rawSort) {
    const sort = spec.sorts[rawSort]
    const order: SortOrder = (rawOrder as SortOrder) || sort.defaultOrder || 'asc'
    orderBy = [{ [sort.field]: sort.nullable ? { sort: order, nulls: 'last' } : order }, { id: order }]
  } else {
    const order: SortOrder = (rawOrder as SortOrder) || spec.defaultSort.order
    orderBy = [{ [spec.defaultSort.field]: order }, { id: order }]
  }

  const rawSummary = single(query.summary)
  const summary = rawSummary === '1' || rawSummary === 'true'

  return { ok: true, value: { page, limit, skip, conditions, orderBy, summary, today } }
}

/** AND the parsed conditions onto the caller's scope; unchanged when there are none. */
export function scopedWhere<T extends object>(scope: T, conditions: Where[]): T | { AND: object[] } {
  return conditions.length ? { AND: [scope, ...conditions] } : scope
}

export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000)

// ─── Route specs ──────────────────────────────────────────────────────────────

export const VEHICLE_STATUSES = ['active', 'inactive', 'delayed'] as const
export const DELIVERY_STATUSES = ['pending', 'in-transit', 'delivered', 'cancelled'] as const
export const CLIENT_TYPES = [
  'restaurant',
  'hotel',
  'office',
  'retail',
  'warehouse',
  'cafe',
  'institution',
  'other',
] as const
export const MAINTENANCE_STATES = ['overdue', 'upcoming', 'completed'] as const
export const MAINTENANCE_PRIORITIES = ['high', 'medium', 'low'] as const

// Search fields are limited to columns every role that can list the resource
// may already read (the driver DTOs expose all of them), so a search cannot
// probe hidden fields.
export const VEHICLE_LIST_SPEC: ListQuerySpec = {
  search: ['name', 'driver', 'location', 'licensePlate', 'vehicleType'].map(containsInsensitive),
  filters: {
    status: { values: VEHICLE_STATUSES, where: (status) => ({ status }) },
    maintenanceDue: { values: ['true', 'false'], where: (value) => ({ maintenanceDue: value === 'true' }) },
  },
  sorts: {
    createdAt: { field: 'createdAt' },
    name: { field: 'name' },
    status: { field: 'status' },
    mileage: { field: 'mileage', nullable: true },
  },
  defaultSort: { field: 'createdAt', order: 'asc' },
}

export const DELIVERY_LIST_SPEC: ListQuerySpec = {
  search: ['customer', 'address', 'driver'].map(containsInsensitive),
  filters: {
    status: { values: DELIVERY_STATUSES, where: (status) => ({ status }) },
  },
  sorts: {
    createdAt: { field: 'createdAt', defaultOrder: 'desc' },
    customer: { field: 'customer' },
    status: { field: 'status' },
    scheduledTime: { field: 'scheduledTime', nullable: true },
  },
  defaultSort: { field: 'createdAt', order: 'desc' },
}

export const MAINTENANCE_LIST_SPEC: ListQuerySpec = {
  search: [
    containsInsensitive('title'),
    containsInsensitive('vehicleName'),
    (q) => ({ vehicle: { is: { name: { contains: q, mode: 'insensitive' } } } }),
  ],
  filters: {
    state: {
      values: MAINTENANCE_STATES,
      where: (state, { today }) =>
        state === 'completed'
          ? { completed: true }
          : state === 'overdue'
            ? { completed: false, dueDate: { lt: today } }
            : { completed: false, dueDate: { gte: today } },
    },
    priority: { values: MAINTENANCE_PRIORITIES, where: (priority) => ({ priority }) },
  },
  sorts: {
    dueDate: { field: 'dueDate' },
    createdAt: { field: 'createdAt' },
    title: { field: 'title' },
    vehicle: { field: 'vehicleName', nullable: true },
  },
  defaultSort: { field: 'dueDate', order: 'asc' },
}

export const CLIENT_LIST_SPEC: ListQuerySpec = {
  search: ['name', 'businessName', 'address', 'phone', 'email'].map(containsInsensitive),
  filters: {
    type: { values: CLIENT_TYPES, where: (type) => ({ type }) },
  },
  sorts: {
    name: { field: 'name' },
    createdAt: { field: 'createdAt', defaultOrder: 'desc' },
    type: { field: 'type' },
    rating: { field: 'rating', nullable: true, defaultOrder: 'desc' },
  },
  defaultSort: { field: 'name', order: 'asc' },
}

/**
 * Inclusive calendar-day range on the maintenance due date (used by the
 * calendar view to load one month).
 */
export function parseDueRange(query: Query): Parsed<Where | null> {
  const from = single(query.dueFrom)
  const to = single(query.dueTo)
  if (from === null || to === null) return { ok: false, error: 'Invalid due date range' }
  if (!from && !to) return { ok: true, value: null }
  const range: Record<string, Date> = {}
  if (from) {
    const day = parseDay(from)
    if (!day) return { ok: false, error: 'Invalid due date range' }
    range.gte = day
  }
  if (to) {
    const day = parseDay(to)
    if (!day) return { ok: false, error: 'Invalid due date range' }
    range.lt = addDays(day, 1)
  }
  if (range.gte && range.lt && range.gte >= range.lt) return { ok: false, error: 'Invalid due date range' }
  return { ok: true, value: { dueDate: range } }
}
