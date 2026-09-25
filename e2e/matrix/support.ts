import { expect, type APIResponse, type Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { signToken } from '../../lib/auth'
import { MATRIX_OWNER_ID, MATRIX_TEAM, matrixUser, type MatrixRole } from '../../prisma/matrix-fixtures'

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
  await signInUser(page, matrixUser(role).id, baseURL, MATRIX_TEAM.id)
}

/** Sign a session for any seeded or test-created user (optionally selecting a team workspace). */
export async function signInUser(page: Page, userId: string, baseURL: string, teamId?: string) {
  const row = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, role: true, tokenVersion: true },
  })
  if (!row) throw new Error(`E2E user ${userId} is missing; run \`npm run db:seed\` first`)
  const token = await signToken(
    { sub: userId, email: row.email, name: row.name, role: row.role, tv: row.tokenVersion },
    '1h'
  )
  const { hostname } = new URL(baseURL)
  await page.context().addCookies([
    { name: 'token', value: token, domain: hostname, path: '/', httpOnly: true, sameSite: 'Lax' },
    ...(teamId
      ? [
          {
            name: 'fleetflow_team',
            value: teamId,
            domain: hostname,
            path: '/',
            httpOnly: true,
            sameSite: 'Lax' as const,
          },
        ]
      : []),
  ])
}

/**
 * Create a throwaway user with a personal workspace for auth-flow specs, so
 * per-email rate limits and lockout state never leak between tests or reruns.
 * Returns the user and a cleanup that removes it with its login codes.
 */
export async function createSyntheticUser(label: string) {
  const id = `e2e-auth-${label}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const email = `${id}@matrix.fleetvera.test`
  await db.user.create({
    data: {
      id,
      email,
      name: `E2E ${label} (synthetic)`,
      role: 'fleet_manager',
      emailVerified: new Date(),
      onboardingCompleted: true,
    },
  })
  const cleanup = async () => {
    await db.verificationToken.deleteMany({ where: { identifier: `login:${email}` } })
    await db.user.deleteMany({ where: { id } })
  }
  return { id, email, cleanup }
}

export async function userSecurityState(userId: string) {
  return db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { twoFactorEnabled: true, tokenVersion: true, backupCodes: true },
  })
}

/**
 * Give this browser context its own client address. The app trusts one proxy
 * hop (TRUSTED_PROXY_HOPS), so X-Forwarded-For selects the per-IP login rate
 * limit bucket; a fresh address per test keeps retries and reruns deterministic.
 */
export async function useFreshClientAddress(page: Page) {
  const octet = () => Math.floor(Math.random() * 250) + 1
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': `10.${octet()}.${octet()}.${octet()}` })
}

/** A Prisma handle for specs that seed or verify rows directly. */
export const matrixDb = db

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

/**
 * Insert a synthetic document that already created its fleet record
 * (status CONFIRMED) in the matrix workspace; returns a cleanup function.
 * Only metadata is stored: no file exists behind the storage key.
 */
export async function seedConfirmedDocument(name: string) {
  const id = `e2e-matrix-doc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const extraction = {
    documentType: 'service_invoice',
    fields: { vendor: { value: 'E2E Matrix Garage', confidence: 0.95, citationIds: [] } },
    services: [],
    parts: [],
    citations: [],
    warnings: [],
  }
  await db.documentUpload.create({
    data: {
      id,
      ownerId: MATRIX_OWNER_ID,
      teamId: MATRIX_TEAM.id,
      scopeKey: `team:${MATRIX_TEAM.id}`,
      uploadedById: MATRIX_OWNER_ID,
      uploadedBySnapshot: 'owner@matrix.fleetvera.test',
      originalName: name,
      mimeType: 'application/pdf',
      byteSize: 16,
      contentSha256: id.padEnd(64, '0').slice(0, 64),
      storageKey: `e2e-matrix/${id}`,
      status: 'CONFIRMED',
      scanStatus: 'CLEAN',
      extraction: JSON.stringify(extraction),
      revision: 4,
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  })
  return async () => {
    await db.documentUpload.deleteMany({ where: { id } })
  }
}

type Resource = 'vehicles' | 'deliveries' | 'maintenance' | 'clients'
export interface RoleExpectation {
  dashboardHeading: string
  view: Record<Resource, boolean>
  create: Record<Resource, boolean>
  manageTeam: boolean
  /** May read the member list (names and emails) at GET /api/team. */
  viewTeam: boolean
  apiKeys: boolean
  viewBilling: boolean
}

const all = (value: boolean): Record<Resource, boolean> => ({
  vehicles: value,
  deliveries: value,
  maintenance: value,
  clients: value,
})

/*
 * The intended feature x role matrix, written independently of
 * lib/permissions.ts so a permission change must be made deliberately in both
 * places. docs/testing/e2e-matrix.md mirrors this table.
 */
export const EXPECTATIONS: Record<MatrixRole, RoleExpectation> = {
  OWNER: {
    dashboardHeading: 'Owner command centre',
    view: all(true),
    create: all(true),
    manageTeam: true,
    viewTeam: true,
    apiKeys: true,
    viewBilling: true,
  },
  ADMIN: {
    dashboardHeading: 'Owner command centre',
    view: all(true),
    create: all(true),
    manageTeam: true,
    viewTeam: true,
    apiKeys: true,
    viewBilling: true,
  },
  MANAGER: {
    dashboardHeading: 'Owner command centre',
    view: all(true),
    create: all(true),
    manageTeam: false,
    viewTeam: true,
    apiKeys: true,
    viewBilling: true,
  },
  DISPATCHER: {
    dashboardHeading: 'Dispatch command centre',
    view: { vehicles: true, deliveries: true, maintenance: false, clients: true },
    create: { vehicles: false, deliveries: true, maintenance: false, clients: false },
    manageTeam: false,
    viewTeam: false,
    apiKeys: false,
    viewBilling: false,
  },
  TECHNICIAN: {
    dashboardHeading: 'Maintenance command centre',
    view: { vehicles: false, deliveries: false, maintenance: true, clients: false },
    create: { vehicles: false, deliveries: false, maintenance: true, clients: false },
    manageTeam: false,
    viewTeam: false,
    apiKeys: false,
    viewBilling: false,
  },
  DRIVER: {
    dashboardHeading: 'Driver command centre',
    view: { vehicles: true, deliveries: true, maintenance: true, clients: false },
    create: all(false),
    manageTeam: false,
    viewTeam: false,
    apiKeys: false,
    viewBilling: false,
  },
  VIEWER: {
    dashboardHeading: 'Fleet overview',
    view: all(true),
    create: all(false),
    manageTeam: false,
    viewTeam: true,
    apiKeys: false,
    viewBilling: false,
  },
}
