import { expect, test, type Page } from '@playwright/test'
import {
  MATRIX_CLIENTS, MATRIX_DELIVERIES, MATRIX_MAINTENANCE, MATRIX_ROLES, MATRIX_TEAM, MATRIX_VEHICLES, matrixUser,
} from '../../prisma/matrix-fixtures'
import { EXPECTATIONS, api, disconnectMatrixDb, expectStatus, signIn } from './support'

/*
 * Feature x role acceptance matrix against the local server and the seeded
 * synthetic workspace (prisma/matrix-fixtures.ts). See docs/testing/e2e-matrix.md.
 */
test.afterAll(disconnectMatrixDb)

const runId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

const RESOURCES = {
  vehicles: {
    api: '/api/vehicles', page: '/vehicles', heading: 'Vehicles',
    seeded: MATRIX_VEHICLES.map((row) => row.name), label: (row: Record<string, unknown>) => row.name,
    body: (id: string) => ({ name: `E2E Matrix Vehicle ${id}`, status: 'active' }),
    remove: (id: string) => `/api/vehicles/${id}`,
  },
  deliveries: {
    api: '/api/deliveries', page: '/deliveries', heading: 'Delivery Management',
    seeded: MATRIX_DELIVERIES.map((row) => row.customer), label: (row: Record<string, unknown>) => row.customer,
    body: (id: string) => ({ customer: `E2E Matrix Customer ${id}`, address: '300 Example Road, Testville' }),
    remove: (id: string) => `/api/deliveries/${id}`,
  },
  maintenance: {
    api: '/api/maintenance', page: '/maintenance', heading: 'Maintenance Calendar',
    seeded: MATRIX_MAINTENANCE.map((row) => row.title), label: (row: Record<string, unknown>) => row.type,
    body: (id: string) => ({ vehicle: 'E2E Van Bravo', type: `E2E Matrix Service ${id}`, dueDate: '2030-02-01', priority: 'low' }),
    remove: (id: string) => `/api/maintenance/${id}`,
  },
  clients: {
    api: '/api/clients', page: '/clients', heading: 'Clients',
    seeded: MATRIX_CLIENTS.map((row) => row.name), label: (row: Record<string, unknown>) => row.name,
    body: (id: string) => ({ name: `E2E Matrix Client ${id}`, address: '400 Example Lane, Testville', type: 'other' }),
    remove: (id: string) => `/api/clients/${id}`,
  },
} as const
type ResourceName = keyof typeof RESOURCES

async function openList(page: Page, resource: ResourceName) {
  const config = RESOURCES[resource]
  const response = await page.goto(config.page)
  expect(response?.ok()).toBe(true)
  await expect(page.getByRole('heading', { level: 1, name: config.heading })).toBeVisible()
  if (resource === 'maintenance') await page.getByRole('button', { name: 'List', exact: true }).click()
}

for (const role of MATRIX_ROLES) {
  const expected = EXPECTATIONS[role]

  test.describe(`${role}`, () => {
    test.beforeEach(async ({ page, baseURL }) => {
      await signIn(page, role, baseURL!)
    })

    test('dashboard loads its role command centre', async ({ page }) => {
      const response = await page.goto('/dashboard')
      expect(response?.ok()).toBe(true)
      await expect(page).toHaveURL(/\/dashboard$/)
      await expect(page.getByRole('heading', { name: expected.dashboardHeading })).toBeVisible()
      await expect(page.getByText('Unable to open this workspace dashboard')).toHaveCount(0)
    })

    for (const resource of Object.keys(RESOURCES) as ResourceName[]) {
      const config = RESOURCES[resource]
      const canView = expected.view[resource]

      test(`${resource}: list ${canView ? 'visible' : 'forbidden'}`, async ({ page, baseURL }) => {
        const response = await api(page, baseURL!).get(`${config.api}?limit=200`)
        await expectStatus(response, canView ? 200 : 403)
        const labels = canView ? ((await response.json()).data as Record<string, unknown>[]).map(config.label) : []
        if (canView && role !== 'DRIVER') expect(labels).toEqual(expect.arrayContaining([...config.seeded]))

        await openList(page, resource)
        const firstSeeded = page.getByText(config.seeded[0], { exact: true })
        if (canView) await expect(firstSeeded.filter({ visible: true }).first()).toBeVisible()
        else {
          await expect(page.getByText('You do not have permission to do that').first()).toBeVisible()
          await expect(firstSeeded).toHaveCount(0)
        }
      })

      const canCreate = expected.create[resource]
      test(`${resource}: create ${canCreate ? 'allowed' : 'forbidden'}`, async ({ page, baseURL }) => {
        const client = api(page, baseURL!)
        const created = await client.post(config.api, config.body(runId()))
        await expectStatus(created, canCreate ? 201 : 403)
        if (canCreate) {
          const { id } = await created.json()
          expect(id).toBeTruthy()
          expect([200, 204]).toContain((await client.delete(config.remove(id))).status())
        }
      })
    }

    test(`team: page loads, member management ${expected.manageTeam ? 'allowed' : 'forbidden'}`, async ({ page, baseURL }) => {
      const response = await page.goto('/team')
      expect(response?.ok()).toBe(true)
      await expect(page.getByRole('heading', { level: 1, name: 'Team Management' })).toBeVisible()

      const client = api(page, baseURL!)
      const invite = await client.post('/api/team/invite', { teamId: MATRIX_TEAM.id, emails: [`invitee-${runId()}@matrix.fleetvera.test`], role: 'VIEWER' })
      await expectStatus(invite, expected.manageTeam ? 200 : 403)
      if (expected.manageTeam) {
        const { results } = await invite.json()
        expect(results).toHaveLength(1)
        expect(results[0].status).toBe('invited')
        // Withdraw the pending invitation so reruns stay deterministic.
        await expectStatus(await client.delete('/api/team', { memberId: results[0].invitationId }), 200)
      }

      if (!expected.manageTeam) {
        const members = await client.get('/api/team')
        if (members.ok()) {
          const viewer = ((await members.json()) as Array<{ id: string; user: { id: string } | null }>).find((member) => member.user?.id === matrixUser('VIEWER').id)
          if (viewer) await expectStatus(await client.put('/api/team', { memberId: viewer.id, role: 'MANAGER' }), 403)
        }
      }
    })

    test(`api keys: ${expected.apiKeys ? 'allowed' : 'forbidden'}`, async ({ page, baseURL }) => {
      const response = await page.goto('/settings/api')
      expect(response?.ok()).toBe(true)
      await expect(page.getByRole('heading', { level: 1, name: 'API & Integrations' })).toBeVisible()

      const client = api(page, baseURL!)
      await expectStatus(await client.get('/api/settings/api-keys'), expected.apiKeys ? 200 : 403)
      const created = await client.post('/api/settings/api-keys', { name: `E2E matrix key ${runId()}` })
      if (!expected.apiKeys) {
        await expectStatus(created, 403)
        await expect(page.getByRole('button', { name: /Generate Key/ }).first()).toBeVisible()
        return
      }
      await expectStatus(created, 201)
      const { apiKey } = await created.json()
      expect(apiKey.key).toMatch(/^ff_[a-f0-9]{64}$/)
      const id = apiKey.id
      await expectStatus(await client.delete(`/api/settings/api-keys?id=${encodeURIComponent(id)}`), 200)
    })

    test(`billing: ${expected.viewBilling ? 'shows the free-beta notice' : 'subscription details forbidden'}`, async ({ page, baseURL }) => {
      await expectStatus(await api(page, baseURL!).get('/api/subscription/status'), expected.viewBilling ? 200 : 403)
      const response = await page.goto('/billing')
      expect(response?.ok()).toBe(true)
      await expect(page.getByRole('heading', { level: 1, name: 'Billing & Subscription' })).toBeVisible()
      if (expected.viewBilling) {
        await expect(page.getByText('Fleetvera is free during the beta')).toBeVisible()
        await expect(page.getByText('No payment details are needed.', { exact: false })).toBeVisible()
      }
    })
  })
}

test.describe('DRIVER assignment scope', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await signIn(page, 'DRIVER', baseURL!)
  })

  const driverId = matrixUser('DRIVER').id
  const scoped = {
    deliveries: MATRIX_DELIVERIES.filter((row) => row.assignedDriverId === driverId),
    vehicles: MATRIX_VEHICLES.filter((row) => row.assignedDriverId === driverId),
    maintenance: MATRIX_MAINTENANCE.filter((row) => MATRIX_VEHICLES.find((vehicle) => vehicle.id === row.vehicleId)?.assignedDriverId === driverId),
  }

  test('APIs return only assigned deliveries, vehicles and their maintenance', async ({ page, baseURL }) => {
    const client = api(page, baseURL!)
    for (const [resource, rows] of Object.entries(scoped) as Array<[keyof typeof scoped, Array<{ id: string }>]>) {
      const response = await client.get(`${RESOURCES[resource].api}?limit=200`)
      await expectStatus(response, 200)
      const body = await response.json()
      expect(((body.data as Array<{ id: string }>).map((row) => row.id)).sort(), resource).toEqual(rows.map((row) => row.id).sort())
      expect(body.total).toBe(rows.length)
    }
    // Direct access to an unassigned delivery is not possible either.
    const unassigned = MATRIX_DELIVERIES.find((row) => row.assignedDriverId === null)!
    expect([403, 404]).toContain((await client.get(`/api/deliveries/${unassigned.id}`)).status())
  })

  test('deliveries page lists only the assigned delivery', async ({ page }) => {
    await openList(page, 'deliveries')
    for (const row of MATRIX_DELIVERIES) {
      const cell = page.getByText(row.customer, { exact: true })
      if (row.assignedDriverId === driverId) await expect(cell.filter({ visible: true }).first()).toBeVisible()
      else await expect(cell).toHaveCount(0)
    }
  })

  test('dashboard shows no unassigned work', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Driver command centre' })).toBeVisible()
    for (const row of MATRIX_DELIVERIES.filter((delivery) => delivery.assignedDriverId !== driverId)) {
      await expect(page.getByText(row.customer, { exact: true })).toHaveCount(0)
    }
    await expect(page.getByText('E2E Van Bravo', { exact: true })).toHaveCount(0)
  })
})
