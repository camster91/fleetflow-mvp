import { readFileSync } from 'fs'
import { join } from 'path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('paginated list routes use a unique tie-breaker', () => {
  it.each([
    'pages/api/vehicles/index.ts',
    'pages/api/deliveries/index.ts',
    'pages/api/clients/index.ts',
    'pages/api/sop/index.ts',
    'pages/api/vending-machines/index.ts',
    'pages/api/maintenance/index.ts',
    'pages/api/admin/users.ts',
    'pages/api/team/members.ts',
  ])('%s orders by id after its primary sort key', (route) => {
    const source = read(route)
    const findMany = source.slice(source.indexOf('.findMany('), source.indexOf('take: limit'))
    expect(findMany).toMatch(/orderBy: \[[\s\S]*\{ id: '(asc|desc)' \}[\s\S]*\]/)
  })
})
