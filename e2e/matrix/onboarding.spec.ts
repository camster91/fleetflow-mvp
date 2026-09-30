import { expect, test, type Page } from '@playwright/test'
import { clearEmailsFor, waitForEmail, waitForLoginCode } from '../support/mail-capture'
import {
  api,
  createSyntheticUser,
  disconnectMatrixDb,
  matrixDb,
  signInUser,
  // Not a React hook: it sets a fresh X-Forwarded-For so login rate limits never carry over.
  useFreshClientAddress as freshClientAddress,
} from './support'

/*
 * The real path for a new customer, with no seeded shortcuts after the first platform admin:
 * the admin invites them from /admin/users, they sign in with an emailed code, create their own
 * team workspace, invite a teammate, and the teammate accepts. See docs/testing/e2e-matrix.md.
 */
test.afterAll(disconnectMatrixDb)

async function signInWithCode(page: Page, email: string, callbackUrl = '/dashboard') {
  await freshClientAddress(page)
  await page.goto(`/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  await page.getByLabel('Email address').fill(email)
  const since = Date.now()
  await page.getByRole('button', { name: 'Send Login Code' }).click()
  const code = await waitForLoginCode(email, since)
  await expect(page.getByLabel('Login code digit 6')).toBeVisible()
  const login = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/auth/login')
  for (const [index, digit] of [...code].entries()) await page.getByLabel(`Login code digit ${index + 1}`).fill(digit)
  const response = await login
  expect(`${response.status()} ${response.status() === 200 ? '' : await response.text()}`.trim()).toBe('200')
  await expect(page).not.toHaveURL(/\/auth\/login/)
}

test('customer onboarding: admin invite → sign in → create team → invite teammate → teammate joins', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000)
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const customerEmail = `e2e-customer-${stamp}@matrix.fleetvera.test`
  const teammateEmail = `e2e-teammate-${stamp}@matrix.fleetvera.test`
  const admin = await createSyntheticUser('onboarding-admin')
  await matrixDb.user.update({ where: { id: admin.id }, data: { role: 'admin' } })

  try {
    // 1. The platform admin invites the customer.
    await signInUser(page, admin.id, baseURL!)
    await page.goto('/admin/users')
    const since = Date.now()
    await page.getByLabel('Email').fill(customerEmail)
    await page.getByLabel('Company (optional)').fill('E2E Northside')
    await page.getByRole('button', { name: 'Send invitation' }).click()
    await expect(page.getByRole('status')).toContainText(`Invitation sent to ${customerEmail}`)
    const invitation = await waitForEmail(customerEmail, /account is ready/, since)
    expect(invitation.text).toContain('/auth/login')

    // 2. The customer signs in with the emailed code and lands in their own workspace.
    const customer = await browser.newContext({ baseURL })
    const customerPage = await customer.newPage()
    await signInWithCode(customerPage, customerEmail, '/team')
    // First sign-in opens the setup wizard; this customer skips it and goes to their team page.
    await expect(customerPage.getByRole('button', { name: 'Skip setup' })).toBeVisible()
    await customerPage.getByRole('button', { name: 'Skip setup' }).click()
    await expect(customerPage).toHaveURL(/\/dashboard/)
    await customerPage.goto('/team')
    await expect(customerPage.getByRole('heading', { name: 'Work with your team' })).toBeVisible()

    // A record added before the team exists must come with them into the team.
    const created = await api(customerPage, baseURL!).post('/api/vehicles', { name: 'E2E Van 1', status: 'active' })
    expect(created.status()).toBeLessThan(300)

    // 3. They create their team, which becomes the active workspace.
    await customerPage.getByLabel('Team name').fill('E2E Northside')
    await customerPage.getByRole('button', { name: 'Create team' }).click()
    await expect(customerPage.getByRole('button', { name: /Invite Member/ })).toBeVisible()
    const team = await matrixDb.team.findFirstOrThrow({
      where: { owner: { email: customerEmail } },
      select: { id: true, name: true },
    })
    expect(team.name).toBe('E2E Northside')
    const vehicles = await (await customerPage.request.get('/api/vehicles')).json()
    const list = Array.isArray(vehicles) ? vehicles : vehicles.data
    expect(list.map((vehicle: { name: string }) => vehicle.name)).toContain('E2E Van 1')
    expect(await matrixDb.vehicle.count({ where: { teamId: team.id, name: 'E2E Van 1' } })).toBe(1)

    // 4. They invite a teammate into the team.
    await customerPage.getByRole('button', { name: /Invite Member/ }).click()
    const invitedAt = Date.now()
    await customerPage.getByPlaceholder('colleague@company.com').first().fill(teammateEmail)
    await customerPage.getByRole('button', { name: /Send Invitations/ }).click()
    await expect(customerPage).toHaveURL(/\/team$/)
    const teamInvite = await waitForEmail(teammateEmail, /invited you/, invitedAt)
    const acceptPath = new URL(teamInvite.text.match(/https?:\/\/\S+\/accept-invite\/\S+/)![0]).pathname

    // 5. The teammate signs in from the invitation and accepts it.
    const teammate = await browser.newContext({ baseURL })
    const teammatePage = await teammate.newPage()
    await signInWithCode(teammatePage, teammateEmail, acceptPath)
    await teammatePage.getByRole('button', { name: /^Accept/ }).click()
    await expect(teammatePage.getByRole('heading', { name: 'Welcome to the Team!' })).toBeVisible()
    const membership = await matrixDb.teamMember.findFirstOrThrow({
      where: { teamId: team.id, user: { email: teammateEmail } },
      select: { status: true },
    })
    expect(membership.status).toBe('ACCEPTED')

    await customer.close()
    await teammate.close()
  } finally {
    const emails = [customerEmail, teammateEmail]
    await Promise.all([...emails, admin.email].map((email) => clearEmailsFor(email)))
    // Vehicles reference their team without cascading, so remove them before the team.
    await matrixDb.vehicle.deleteMany({ where: { owner: { email: customerEmail } } })
    await matrixDb.team.deleteMany({ where: { owner: { email: customerEmail } } })
    await matrixDb.verificationToken.deleteMany({ where: { identifier: { in: emails.map((e) => `login:${e}`) } } })
    const created = await matrixDb.user.findMany({ where: { email: { in: emails } }, select: { id: true } })
    const userIds = [...created.map((row) => row.id), admin.id]
    await matrixDb.auditLog.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { entityId: { in: userIds } }] } })
    await matrixDb.user.deleteMany({ where: { email: { in: emails } } })
    await admin.cleanup()
  }
})
