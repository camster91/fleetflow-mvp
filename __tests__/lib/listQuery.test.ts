import {
  CLIENT_LIST_SPEC, DELIVERY_LIST_SPEC, MAINTENANCE_LIST_SPEC, VEHICLE_LIST_SPEC,
  parseDueRange, parseListQuery, scopedWhere,
} from '@/lib/listQuery'

const NOW = new Date('2026-09-25T15:30:00Z')
const TODAY = new Date('2026-09-25T00:00:00Z')

function ok(query: Record<string, string | string[] | undefined>, spec = VEHICLE_LIST_SPEC) {
  const parsed = parseListQuery(query, spec, NOW)
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.value
}
const error = (query: Record<string, string | string[] | undefined>, spec = VEHICLE_LIST_SPEC) => {
  const parsed = parseListQuery(query, spec, NOW)
  return parsed.ok ? null : parsed.error
}

describe('parseListQuery', () => {
  it('keeps the historical defaults and lenient page/limit parsing', () => {
    expect(ok({})).toMatchObject({ page: 1, limit: 50, skip: 0, conditions: [], summary: false, today: TODAY })
    expect(ok({ page: '3', limit: '25' })).toMatchObject({ page: 3, limit: 25, skip: 50 })
    expect(ok({ page: '0', limit: '0' })).toMatchObject({ page: 1, limit: 50 })
    expect(ok({ page: '-4', limit: 'abc' })).toMatchObject({ page: 1, limit: 50 })
    expect(ok({ limit: '5000' })).toMatchObject({ limit: 200 })
    expect(ok({ page: ['2', '3'] })).toMatchObject({ page: 1 })
  })

  it('keeps each route default order with an id tie-breaker in the same direction', () => {
    expect(ok({}).orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }])
    expect(ok({}, DELIVERY_LIST_SPEC).orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }])
    expect(ok({}, MAINTENANCE_LIST_SPEC).orderBy).toEqual([{ dueDate: 'asc' }, { id: 'asc' }])
    expect(ok({}, CLIENT_LIST_SPEC).orderBy).toEqual([{ name: 'asc' }, { id: 'asc' }])
  })

  it('sorts only by allow-listed keys, puts nulls last and always ends with id', () => {
    expect(ok({ sort: 'name', order: 'desc' }).orderBy).toEqual([{ name: 'desc' }, { id: 'desc' }])
    expect(ok({ sort: 'mileage' }).orderBy).toEqual([{ mileage: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }])
    expect(ok({ sort: 'rating' }, CLIENT_LIST_SPEC).orderBy).toEqual([{ rating: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }])
    expect(ok({ sort: 'vehicle' }, MAINTENANCE_LIST_SPEC).orderBy[0]).toEqual({ vehicleName: { sort: 'asc', nulls: 'last' } })
    expect(error({ sort: 'ownerId' })).toBe('Invalid sort')
    expect(error({ sort: '__proto__' })).toBe('Invalid sort')
    expect(error({ sort: 'constructor' })).toBe('Invalid sort')
    expect(error({ sort: ['name', 'status'] })).toBe('Invalid sort')
    expect(error({ sort: 'name', order: 'sideways' })).toBe('Invalid sort order')
  })

  it('searches case-insensitively over the allow-listed text fields', () => {
    const { conditions } = ok({ q: '  Van 7  ' })
    expect(conditions).toEqual([{ OR: [
      { name: { contains: 'Van 7', mode: 'insensitive' } },
      { driver: { contains: 'Van 7', mode: 'insensitive' } },
      { location: { contains: 'Van 7', mode: 'insensitive' } },
      { licensePlate: { contains: 'Van 7', mode: 'insensitive' } },
      { vehicleType: { contains: 'Van 7', mode: 'insensitive' } },
    ] }])
    const maintenance = ok({ q: 'brake' }, MAINTENANCE_LIST_SPEC).conditions[0] as { OR: unknown[] }
    expect(maintenance.OR).toContainEqual({ vehicle: { is: { name: { contains: 'brake', mode: 'insensitive' } } } })
  })

  it('ignores a blank search and rejects oversized or repeated ones', () => {
    expect(ok({ q: '   ' }).conditions).toEqual([])
    expect(ok({ q: 'x'.repeat(100) }).conditions).toHaveLength(1)
    expect(error({ q: 'x'.repeat(101) })).toBe('Search query is too long')
    expect(error({ q: ['a', 'b'] })).toBe('Invalid search query')
  })

  it('applies only known filter values; "all" means no filter', () => {
    expect(ok({ status: 'delayed' }).conditions).toEqual([{ status: 'delayed' }])
    expect(ok({ status: 'all' }).conditions).toEqual([])
    expect(ok({ status: '' }).conditions).toEqual([])
    expect(ok({ maintenanceDue: 'true' }).conditions).toEqual([{ maintenanceDue: true }])
    expect(error({ status: 'retired' })).toBe('Invalid status filter')
    expect(error({ status: ['active', 'delayed'] })).toBe('Invalid status filter')
    expect(ok({ status: 'cancelled' }, DELIVERY_LIST_SPEC).conditions).toEqual([{ status: 'cancelled' }])
    expect(ok({ type: 'hotel' }, CLIENT_LIST_SPEC).conditions).toEqual([{ type: 'hotel' }])
    expect(error({ type: 'castle' }, CLIENT_LIST_SPEC)).toBe('Invalid type filter')
  })

  it('combines search and filters as separate AND conditions', () => {
    expect(ok({ q: 'north', status: 'pending' }, DELIVERY_LIST_SPEC).conditions).toHaveLength(2)
  })

  it('evaluates maintenance states against the caller calendar day', () => {
    const today = new Date('2026-09-20T00:00:00Z')
    expect(ok({ state: 'overdue', today: '2026-09-20' }, MAINTENANCE_LIST_SPEC).conditions).toEqual([{ completed: false, dueDate: { lt: today } }])
    expect(ok({ state: 'upcoming', today: '2026-09-20' }, MAINTENANCE_LIST_SPEC).conditions).toEqual([{ completed: false, dueDate: { gte: today } }])
    expect(ok({ state: 'completed' }, MAINTENANCE_LIST_SPEC).conditions).toEqual([{ completed: true }])
    expect(ok({ state: 'overdue' }, MAINTENANCE_LIST_SPEC).conditions).toEqual([{ completed: false, dueDate: { lt: TODAY } }])
    expect(error({ today: '2026-02-30' }, MAINTENANCE_LIST_SPEC)).toBe('Invalid today')
    expect(error({ today: 'yesterday' }, MAINTENANCE_LIST_SPEC)).toBe('Invalid today')
  })

  it('only enables the summary when explicitly requested', () => {
    expect(ok({ summary: '1' }).summary).toBe(true)
    expect(ok({ summary: 'true' }).summary).toBe(true)
    expect(ok({ summary: 'yes' }).summary).toBe(false)
  })
})

describe('parseDueRange', () => {
  it('builds an inclusive calendar-day range', () => {
    expect(parseDueRange({})).toEqual({ ok: true, value: null })
    expect(parseDueRange({ dueFrom: '2026-09-01', dueTo: '2026-09-30' })).toEqual({ ok: true, value: {
      dueDate: { gte: new Date('2026-09-01T00:00:00Z'), lt: new Date('2026-10-01T00:00:00Z') },
    } })
    expect(parseDueRange({ dueFrom: '2026-09-01' })).toEqual({ ok: true, value: { dueDate: { gte: new Date('2026-09-01T00:00:00Z') } } })
  })

  it('rejects invalid or inverted ranges', () => {
    expect(parseDueRange({ dueFrom: 'soon' }).ok).toBe(false)
    expect(parseDueRange({ dueTo: '2026-13-01' }).ok).toBe(false)
    expect(parseDueRange({ dueFrom: '2026-09-02', dueTo: '2026-08-01' }).ok).toBe(false)
    expect(parseDueRange({ dueFrom: ['2026-09-01', '2026-09-02'] }).ok).toBe(false)
  })
})

describe('scopedWhere', () => {
  it('keeps the scope object unchanged when unfiltered and ANDs conditions otherwise', () => {
    const scope = { teamId: 'team-1' }
    expect(scopedWhere(scope, [])).toBe(scope)
    expect(scopedWhere(scope, [{ status: 'active' }])).toEqual({ AND: [scope, { status: 'active' }] })
  })
})
