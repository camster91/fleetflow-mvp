import { readFileSync } from 'fs'
import { join } from 'path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('delivery mutation hardening', () => {
  const collectionRoute = read('pages/api/deliveries/index.ts')
  const itemRoute = read('pages/api/deliveries/[id]/index.ts')

  it('enforces same-origin checks before collection mutations', () => {
    expect(collectionRoute).toContain("requireTenantContext, assertSameOrigin")
    const guard = collectionRoute.indexOf('if (!assertSameOrigin(req, res)) return')
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(collectionRoute.indexOf("if (req.method === 'POST')"))
  })

  it('enforces same-origin checks before item mutations', () => {
    expect(itemRoute).toContain("requireTenantContext, assertSameOrigin")
    const guard = itemRoute.indexOf('if (!assertSameOrigin(req, res)) return')
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(itemRoute.indexOf("if (req.method === 'PUT')"))
    expect(guard).toBeLessThan(itemRoute.indexOf("if (req.method === 'DELETE')"))
  })

  it('creates the delivery and audit record in one transaction', () => {
    expect(collectionRoute).toContain('const delivery = await prisma.$transaction(async (tx) => {')
    expect(collectionRoute).toContain('const created = await tx.delivery.create({ data })')
    expect(collectionRoute).toContain('await logActivity(tx, {')
  })

  it('deletes the delivery and records the audit event in one transaction', () => {
    const deleteTransaction = itemRoute.indexOf('await prisma.$transaction(async (tx) => {', itemRoute.indexOf("if (req.method === 'DELETE')"))
    expect(deleteTransaction).toBeGreaterThan(-1)
    expect(itemRoute.indexOf('await tx.delivery.delete({ where: { id } })', deleteTransaction)).toBeGreaterThan(deleteTransaction)
    expect(itemRoute.indexOf('await logActivity(tx, {', deleteTransaction)).toBeGreaterThan(deleteTransaction)
  })
})
