import { expect, type APIResponse, type Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { signToken } from '../../lib/auth'
import { MATRIX_TEAM, matrixUser, type MatrixRole } from '../../prisma/matrix-fixtures'

/*
 * Test-only authentication for the role matrix. Login is a passwordless email
 * code, so instead of adding any backdoor route the suite signs a normal
 * session JWT with the app's own helper and JWT_SECRET, carrying the user's
 * current tokenVersion exactly like pages/api/auth/login.ts does. It only
 * works against a server that shares this process's JWT_SECRET and database,
 * i.e. the local CI server started by playwright.config.ts.
 */
const db = new PrismaClient()

export async function signIn(page: Page, role: MatrixRole, baseURL: string) {
  const user = matrixUser(role)
  const row = await db.user.findUnique({ where: { id: user.id }, select: { email: true, name: true, role: true, tokenVersion: true } })
  if (!row) throw new Error(`Role-matrix user ${user.id} is missing; run \`npm run db:seed\` first`)
  const token = await signToken({ sub: user.id, email: row.email, name: row.name, role: row.role, tv: row.tokenVersion }, '1h')
  const { hostname } = new URL(baseURL)
  await page.context().addCookies([
    { name: 'token', value: token, domain: hostname, path: '/', httpOnly: true, sameSite: 'Lax' },
    { name: 'fleetflow_team', value: MATRIX_TEAM.id, domain: hostname, path: '/', httpOnly: true, sameSite: 'Lax' },
  ])
}

/** Same-origin API client that reuses the page's session cookies. */
export function api(page: Page, baseURL: string) {
  const headers = { origin: baseURL, referer: `${baseURL}/dashboard` }
  return {
    get: (path: string) => page.request.get(path),
    post: (path: string, data: unknown) => page.request.post(path, { data, headers }),
    put: (path: string, data: unknown) => page.request.put(path, { data, headers }),
    delete: (path: string, data?: unknown) => page.request.delete(path, { data, headers }),
  }
}

export async function expectStatus(response: APIResponse, expected: number) {
  if (response.status() !== expected) {
    expect(`${response.status()} ${await response.text()}`).toBe(`${expected} (${response.url()})`)
  }
}

export async function disconnectMatrixDb() {
  await db.$disconnect()
}

type Resource = 'vehicles' | 'deliveries' | 'maintenance' | 'clients'
export interface RoleExpectation {
  dashboardHeading: string
  view: Record<Resource, boolean>
  create: Record<Resource, boolean>
  manageTeam: boolean
  apiKeys: boolean
  viewBilling: boolean
}

const all = (value: boolean): Record<Resource, boolean> => ({ vehicles: value, deliveries: value, maintenance: value, clients: value })

/*
 * The intended feature x role matrix, written independently of
 * lib/permissions.ts so a permission change must be made deliberately in both
 * places. docs/testing/e2e-matrix.md mirrors this table.
 */
export const EXPECTATIONS: Record<MatrixRole, RoleExpectation> = {
  OWNER: { dashboardHeading: 'Owner command centre', view: all(true), create: all(true), manageTeam: true, apiKeys: true, viewBilling: true },
  ADMIN: { dashboardHeading: 'Owner command centre', view: all(true), create: all(true), manageTeam: true, apiKeys: true, viewBilling: true },
  MANAGER: { dashboardHeading: 'Owner command centre', view: all(true), create: all(true), manageTeam: false, apiKeys: true, viewBilling: true },
  DISPATCHER: {
    dashboardHeading: 'Dispatch command centre',
    view: { vehicles: true, deliveries: true, maintenance: false, clients: true },
    create: { vehicles: false, deliveries: true, maintenance: false, clients: false },
    manageTeam: false, apiKeys: false, viewBilling: false,
  },
  TECHNICIAN: {
    dashboardHeading: 'Maintenance command centre',
    view: { vehicles: false, deliveries: false, maintenance: true, clients: false },
    create: { vehicles: false, deliveries: false, maintenance: true, clients: false },
    manageTeam: false, apiKeys: false, viewBilling: false,
  },
  DRIVER: {
    dashboardHeading: 'Driver command centre',
    view: { vehicles: true, deliveries: true, maintenance: true, clients: false },
    create: all(false), manageTeam: false, apiKeys: false, viewBilling: false,
  },
  VIEWER: { dashboardHeading: 'Fleet overview', view: all(true), create: all(false), manageTeam: false, apiKeys: false, viewBilling: false },
}
