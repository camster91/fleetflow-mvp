import { readFileSync } from 'fs'
import { join } from 'path'
import {
  CLIENT_LIST_SPEC, DELIVERY_LIST_SPEC, MAINTENANCE_LIST_SPEC, VEHICLE_LIST_SPEC, parseListQuery,
} from '@/lib/listQuery'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('paginated list routes use a unique tie-breaker', () => {
  it.each([
    'pages/api/sop/index.ts',
    'pages/api/vending-machines/index.ts',
    'pages/api/admin/users.ts',
    'pages/api/team/members.ts',
    'pages/api/notifications/index.ts',
    'lib/notifications.ts',
  ])('%s orders by id after its primary sort key', (route) => {
    const source = read(route)
    const findMany = source.slice(source.indexOf('.findMany('), source.indexOf('take: limit'))
    expect(findMany).toMatch(/orderBy: \[[\s\S]*\{ id: '(asc|desc)' \}[\s\S]*\]/)
  })

  // These routes accept an allow-listed `sort`; the id tie-breaker comes from parseListQuery.
  it.each([
    ['pages/api/vehicles/index.ts', VEHICLE_LIST_SPEC],
    ['pages/api/deliveries/index.ts', DELIVERY_LIST_SPEC],
    ['pages/api/clients/index.ts', CLIENT_LIST_SPEC],
    ['pages/api/maintenance/index.ts', MAINTENANCE_LIST_SPEC],
  ] as const)('%s orders by the parsed sort, which always ends with id', (route, spec) => {
    const source = read(route)
    expect(source).toMatch(/parseListQuery\(req\.query, [A-Z_]+_LIST_SPEC\)/)
    const findMany = source.slice(source.indexOf('.findMany('), source.indexOf('take: limit'))
    expect(findMany).toMatch(/orderBy: orderBy as /)
    for (const sort of ['', ...Object.keys(spec.sorts)]) {
      for (const order of ['', 'asc', 'desc']) {
        const parsed = parseListQuery({ sort, order }, spec)
        if (!parsed.ok) throw new Error(parsed.error)
        expect(parsed.value.orderBy.at(-1)).toEqual({ id: expect.stringMatching(/^(asc|desc)$/) })
        expect(parsed.value.orderBy).toHaveLength(2)
      }
    }
  })
})
