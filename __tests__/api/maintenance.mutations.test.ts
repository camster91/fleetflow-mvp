import { readFileSync } from 'fs'
import { join } from 'path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('maintenance mutation integrity', () => {
  const collectionRoute = read('pages/api/maintenance/index.ts')
  const itemRoute = read('pages/api/maintenance/[id].ts')

  it('guards cookie-authenticated mutations with the shared same-origin policy', () => {
    for (const source of [collectionRoute, itemRoute]) {
      expect(source).toContain('assertSameOrigin')
      expect(source).toContain('if (!assertSameOrigin(req, res)) return')
    }
    expect(collectionRoute.indexOf('if (!assertSameOrigin(req, res)) return'))
      .toBeLessThan(collectionRoute.indexOf("if (req.method === 'POST')"))
    expect(itemRoute.indexOf('if (!assertSameOrigin(req, res)) return'))
      .toBeLessThan(itemRoute.indexOf("if (req.method === 'PUT')"))
  })

  it('commits creation and its activity record together', () => {
    expect(collectionRoute).toContain('const task = await prisma.$transaction(async (tx) => {')
    expect(collectionRoute).toContain('const created = await tx.maintenanceTask.create({ data })')
    expect(collectionRoute).toContain('await logActivity(tx, {')
  })

  it('commits updates and deletion with their activity records', () => {
    const put = itemRoute.indexOf("if (req.method === 'PUT')")
    const del = itemRoute.indexOf("if (req.method === 'DELETE')")
    expect(itemRoute.indexOf('const task = await prisma.$transaction(async (tx) => {', put)).toBeGreaterThan(put)
    expect(itemRoute.indexOf('const updated = await tx.maintenanceTask.update(', put)).toBeGreaterThan(put)
    expect(itemRoute.indexOf('await logActivity(tx, {', put)).toBeGreaterThan(put)
    expect(itemRoute.indexOf('await prisma.$transaction(async (tx) => {', del)).toBeGreaterThan(del)
    expect(itemRoute.indexOf('await tx.maintenanceTask.delete({ where: { id } })', del)).toBeGreaterThan(del)
    expect(itemRoute.indexOf('await logActivity(tx, {', del)).toBeGreaterThan(del)
  })
})
