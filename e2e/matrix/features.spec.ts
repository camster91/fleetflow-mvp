import { expect, test, type Page } from '@playwright/test'
import { MATRIX_ROLES, MATRIX_TEAM, matrixUser, type MatrixRole } from '../../prisma/matrix-fixtures'
import { api, createSyntheticUser, disconnectMatrixDb, expectStatus, matrixDb, signIn, signInUser } from './support'

/*
 * Feature coverage beyond the core list resources: SOPs, vending machines,
 * reports, intelligence, documents, notifications, workspace settings and
 * idempotent creates. See docs/testing/e2e-matrix.md for the table.
 */
test.afterAll(disconnectMatrixDb)

const runId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const ROLES = (...roles: MatrixRole[]) => new Set<MatrixRole>(roles)

/* Intended access, written independently of lib/permissions.ts (like EXPECTATIONS in support.ts). */
const FEATURES = {
  sopView: ROLES('OWNER', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'DRIVER', 'VIEWER'),
  sopManage: ROLES('OWNER', 'ADMIN', 'MANAGER'),
  vendingView: ROLES('OWNER', 'ADMIN', 'MANAGER', 'VIEWER'),
  vendingManage: ROLES('OWNER', 'ADMIN', 'MANAGER'),
  reports: ROLES('OWNER', 'ADMIN', 'MANAGER'),
  intelligence: ROLES('OWNER', 'ADMIN', 'MANAGER', 'VIEWER'),
  workspaceSettings: ROLES('OWNER', 'ADMIN'),
  checkout: ROLES('OWNER', 'ADMIN'),
}

const sameOrigin = (baseURL: string) => ({ origin: baseURL, referer: `${baseURL}/dashboard` })

async function expectHeading(page: Page, path: string, name: string) {
  const response = await page.goto(path)
  expect(response?.ok(), path).toBe(true)
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

test.describe('feature access by role', () => {
  // One SOP category and one vending machine per worker, created by the owner.
  let sop: { id: string; name: string }
  let machine: { id: string; name: string }
  test.beforeAll(async () => {
    const id = runId()
    sop = await matrixDb.sOPCategory.create({ data: { name: `E2E SOP ${id}`, description: 'Synthetic procedure', ownerId: matrixUser('OWNER').id, teamId: MATRIX_TEAM.id }, select: { id: true, name: true } })
    machine = await matrixDb.vendingMachine.create({ data: { name: `E2E Machine ${id}`, location: 'E2E Depot lobby', ownerId: matrixUser('OWNER').id, teamId: MATRIX_TEAM.id }, select: { id: true, name: true } })
  })
  test.afterAll(async () => {
    await matrixDb.sOPCategory.deleteMany({ where: { id: sop.id } })
    await matrixDb.vendingMachine.deleteMany({ where: { id: machine.id } })
  })

  for (const role of MATRIX_ROLES) {
    test(`${role}: SOPs, vending, reports, intelligence and settings follow the role`, async ({ page, baseURL }) => {
      await signIn(page, role, baseURL!)
      const client = api(page, baseURL!)

      // SOPs
      const sops = await client.get('/api/sop?limit=200')
      await expectStatus(sops, FEATURES.sopView.has(role) ? 200 : 403)
      if (FEATURES.sopView.has(role)) expect((await sops.json()).data.map((row: { id: string }) => row.id)).toContain(sop.id)
      await expectStatus(await client.post('/api/sop', { name: `E2E SOP forbidden ${runId()}` }).then(async (created) => {
        if (created.status() === 201) await client.delete(`/api/sop/${(await created.json()).id}`)
        return created
      }), FEATURES.sopManage.has(role) ? 201 : 403)
      await expectHeading(page, '/sop', 'SOPs & Procedures')
      if (FEATURES.sopView.has(role)) await expect(page.getByText(sop.name).first()).toBeVisible()
      else await expect(page.getByText(sop.name)).toHaveCount(0)
      await expect(page.getByRole('button', { name: `Edit ${sop.name}` })).toHaveCount(FEATURES.sopManage.has(role) ? 1 : 0)

      // Vending machines
      const machines = await client.get('/api/vending-machines?limit=200')
      await expectStatus(machines, FEATURES.vendingView.has(role) ? 200 : 403)
      if (FEATURES.vendingView.has(role)) expect((await machines.json()).data.map((row: { id: string }) => row.id)).toContain(machine.id)
      await expectStatus(await client.put(`/api/vending-machines/${machine.id}`, { name: machine.name, location: 'E2E Depot lobby', notes: 'role check' }), FEATURES.vendingManage.has(role) ? 200 : 403)
      await expectHeading(page, '/vending-machines', 'Vending Machines')
      if (FEATURES.vendingView.has(role)) await expect(page.getByText(machine.name).first()).toBeVisible()
      else await expect(page.getByText(machine.name)).toHaveCount(0)

      // Reports
      for (const report of ['fleet', 'deliveries', 'maintenance']) {
        await expectStatus(await client.get(`/api/reports/${report}`), FEATURES.reports.has(role) ? 200 : 403)
      }
      await expectHeading(page, '/reports', 'Reports')

      // Intelligence brief
      await expectStatus(await client.get('/api/intelligence/brief'), FEATURES.intelligence.has(role) ? 200 : 403)
      if (FEATURES.intelligence.has(role)) await expectHeading(page, '/intelligence', 'Fleet intelligence findings')

      // Workspace time zone: everyone reads it, only owners and admins change it.
      const workspace = await client.get('/api/settings/workspace')
      await expectStatus(workspace, 200)
      const { timeZone, canEdit } = await workspace.json()
      expect(canEdit).toBe(FEATURES.workspaceSettings.has(role))
      const patch = await page.request.patch('/api/settings/workspace', { data: { timeZone }, headers: sameOrigin(baseURL!) })
      await expectStatus(patch, FEATURES.workspaceSettings.has(role) ? 200 : 403)

      // Checkout is never offered during the free beta: billing roles get "unavailable", others are forbidden.
      await expectStatus(await client.post('/api/stripe/checkout-session', { interval: 'monthly' }), FEATURES.checkout.has(role) ? 503 : 403)
    })
  }
})

test.describe('OWNER workflows', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await signIn(page, 'OWNER', baseURL!)
  })

  test('SOP category: create, rename, list, delete', async ({ page, baseURL }) => {
    const client = api(page, baseURL!)
    const name = `E2E SOP CRUD ${runId()}`
    const created = await client.post('/api/sop', { name, description: 'Pre-trip checklist' })
    await expectStatus(created, 201)
    const { id } = await created.json()
    await expectStatus(await client.post('/api/sop', { name: '' }), 400)

    const renamed = `${name} (rev 2)`
    const updated = await client.put(`/api/sop/${id}`, { name: renamed })
    await expectStatus(updated, 200)
    expect((await updated.json()).name).toBe(renamed)

    await expectHeading(page, '/sop', 'SOPs & Procedures')
    await expect(page.getByText(renamed).first()).toBeVisible()
    await expectStatus(await client.delete(`/api/sop/${id}`), 200)
    await expectStatus(await client.delete(`/api/sop/${id}`), 404)
    await page.reload()
    await expect(page.getByText(renamed)).toHaveCount(0)
  })

  test('vending machine: create, update, list, delete', async ({ page, baseURL }) => {
    const client = api(page, baseURL!)
    const name = `E2E Vending CRUD ${runId()}`
    await expectStatus(await client.post('/api/vending-machines', { name }), 400)
    const created = await client.post('/api/vending-machines', { name, location: 'E2E Break room', type: 'snacks' })
    await expectStatus(created, 201)
    const { id } = await created.json()

    const updated = await client.put(`/api/vending-machines/${id}`, { name, location: 'E2E Break room', type: 'snacks', status: 'maintenance' })
    await expectStatus(updated, 200)
    expect((await updated.json()).status).toBe('maintenance')

    await expectHeading(page, '/vending-machines', 'Vending Machines')
    await expect(page.getByText(name).first()).toBeVisible()
    await expect(page.getByRole('button', { name: `Edit ${name}` }).filter({ visible: true })).toHaveCount(1)
    await expectStatus(await client.delete(`/api/vending-machines/${id}`), 200)
    const remaining = await client.get('/api/vending-machines?limit=200')
    expect((await remaining.json()).data.map((row: { id: string }) => row.id)).not.toContain(id)
  })

  test('workspace time zone: owner changes it in settings; an invalid zone is rejected', async ({ page, baseURL }) => {
    const original = (await matrixDb.team.findUniqueOrThrow({ where: { id: MATRIX_TEAM.id }, select: { timeZone: true } })).timeZone
    const target = original === 'America/Vancouver' ? 'America/Halifax' : 'America/Vancouver'
    try {
      await expectHeading(page, '/settings/company', 'Company Settings')
      const select = page.getByLabel('Time zone')
      await expect(select).toHaveValue(original)
      await select.selectOption(target)
      await page.getByRole('button', { name: 'Save time zone' }).click()
      await expect(page.getByRole('button', { name: 'Save time zone' })).toBeDisabled()
      await expect.poll(async () => (await matrixDb.team.findUniqueOrThrow({ where: { id: MATRIX_TEAM.id } })).timeZone).toBe(target)

      const invalid = await page.request.patch('/api/settings/workspace', { data: { timeZone: 'Mars/Olympus_Mons' }, headers: sameOrigin(baseURL!) })
      await expectStatus(invalid, 400)
      expect((await invalid.json()).error).toMatch(/valid IANA time zone/)
      expect((await matrixDb.team.findUniqueOrThrow({ where: { id: MATRIX_TEAM.id } })).timeZone).toBe(target)
    } finally {
      await matrixDb.team.update({ where: { id: MATRIX_TEAM.id }, data: { timeZone: original } })
    }
  })

  test('deliveries: the same Idempotency-Key twice creates one delivery', async ({ page, baseURL }) => {
    const customer = `E2E Idempotent Customer ${runId()}`
    const key = `e2e-matrix-${runId()}`
    const post = () => page.request.post('/api/deliveries', {
      data: { customer, address: '500 Example Road, Testville' },
      headers: { ...sameOrigin(baseURL!), 'Idempotency-Key': key },
    })
    try {
      const first = await post()
      await expectStatus(first, 201)
      const second = await post()
      await expectStatus(second, 201)
      expect(second.headers()['idempotent-replayed']).toBe('true')
      expect((await second.json()).id).toBe((await first.json()).id)
      expect(await matrixDb.delivery.count({ where: { teamId: MATRIX_TEAM.id, customer } })).toBe(1)

      // Reusing the key for a different body is refused rather than silently replayed.
      const conflicting = await page.request.post('/api/deliveries', {
        data: { customer: `${customer} changed`, address: '500 Example Road, Testville' },
        headers: { ...sameOrigin(baseURL!), 'Idempotency-Key': key },
      })
      await expectStatus(conflicting, 422)
    } finally {
      await matrixDb.delivery.deleteMany({ where: { teamId: MATRIX_TEAM.id, customer: { startsWith: customer } } })
      await matrixDb.idempotencyKey.deleteMany({ where: { key } })
    }
  })

  test('notifications: a new notification is listed and can be marked read', async ({ page, baseURL }) => {
    const title = `E2E notification ${runId()}`
    const row = await matrixDb.notification.create({ data: { userId: matrixUser('OWNER').id, type: 'system', title, message: 'Synthetic notification for the E2E matrix' } })
    try {
      await expectHeading(page, '/notifications', 'Notifications')
      await expect(page.getByText(title)).toBeVisible()
      await page.getByRole('button', { name: 'Mark as read' }).first().click()
      await expect.poll(async () => (await matrixDb.notification.findUniqueOrThrow({ where: { id: row.id } })).read).toBe(true)

      // Notifications are per user: another member never sees them.
      const other = await page.context().browser()!.newContext()
      const otherPage = await other.newPage()
      await signIn(otherPage, 'VIEWER', baseURL!)
      const list = await otherPage.request.get('/api/notifications?limit=100')
      await expectStatus(list, 200)
      expect(JSON.stringify(await list.json())).not.toContain(title)
      await other.close()
    } finally {
      await matrixDb.notification.deleteMany({ where: { id: row.id } })
    }
  })
})

test('documents: an empty workspace shows the empty state and uploads fail closed without storage', async ({ page, baseURL }) => {
  const user = await createSyntheticUser('documents')
  try {
    await signInUser(page, user.id, baseURL!)
    const list = await page.request.get('/api/documents/upload')
    await expectStatus(list, 200)
    expect((await list.json()).documents).toEqual([])
    await expectHeading(page, '/documents', 'Document intelligence')
    await expect(page.getByText('No documents yet.')).toBeVisible()

    // The CI server has no document scanner configured (production mode), so an upload is refused and nothing is stored.
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n')
    const upload = await page.request.post('/api/documents/upload', {
      data: pdf,
      headers: { ...sameOrigin(baseURL!), 'Content-Type': 'application/pdf', 'X-File-Name': 'e2e-disabled.pdf' },
    })
    await expectStatus(upload, 503)
    expect((await upload.json()).error).toBe('Document scanning is unavailable')
    expect(await matrixDb.documentUpload.count({ where: { ownerId: user.id } })).toBe(0)
  } finally {
    await user.cleanup()
  }
})
