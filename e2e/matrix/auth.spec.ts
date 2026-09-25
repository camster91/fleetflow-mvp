import { expect, test, type Browser, type Page } from '@playwright/test'
import speakeasy from 'speakeasy'
import { clearEmailsFor, waitForEmail, waitForLoginCode } from '../support/mail-capture'
import {
  createSyntheticUser,
  disconnectMatrixDb,
  expectStatus,
  signInUser,
  useFreshClientAddress,
  userSecurityState,
} from './support'

/*
 * Real authentication flows against the local server: the email login code is
 * read from the test-only mail capture (lib/emailCapture.ts), TOTP codes are
 * generated from the secret the setup endpoint returns. Each test creates its
 * own synthetic user and client address, so rate limits and lockouts never
 * carry over between tests, retries or reruns. See docs/testing/e2e-matrix.md.
 */
test.afterAll(disconnectMatrixDb)

type SyntheticUser = Awaited<ReturnType<typeof createSyntheticUser>>
let user: SyntheticUser

test.beforeEach(async ({ page }, testInfo) => {
  user = await createSyntheticUser(
    testInfo.title
      .split(':')[0]
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase()
  )
  await useFreshClientAddress(page)
})
test.afterEach(async () => {
  await clearEmailsFor(user.email)
  await user.cleanup()
})

async function requestLoginCode(page: Page, email: string) {
  await page.goto('/auth/login')
  await page.getByLabel('Email address').fill(email)
  const since = Date.now()
  await page.getByRole('button', { name: 'Send Login Code' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  return waitForLoginCode(email, since)
}

/** Types a code into the six digit boxes; the page submits after the last digit. */
async function enterLoginCode(page: Page, code: string) {
  for (const [index, digit] of [...code].entries()) {
    await page.getByLabel(`Login code digit ${index + 1}`).fill(digit)
  }
}

async function me(page: Page) {
  return page.request.get('/api/auth/me')
}

function totp(secret: string, offsetSeconds = 0) {
  return speakeasy.totp({ secret, encoding: 'base32', time: Math.floor(Date.now() / 1000) + offsetSeconds })
}

async function openAccountMenu(page: Page, email: string) {
  const account = page.getByRole('button', { name: new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
  // Below the lg breakpoint the account menu lives in the off-canvas sidebar.
  if ((page.viewportSize()?.width ?? 1280) < 1024)
    await page.getByRole('button', { name: 'Open menu' }).filter({ visible: true }).first().click()
  await account.click()
}

test('email code: request, sign in, and sign out', async ({ page }) => {
  const code = await requestLoginCode(page, user.email)
  await enterLoginCode(page, code)
  await expect(page).toHaveURL(/\/dashboard$/)

  const session = await me(page)
  await expectStatus(session, 200)
  expect((await session.json()).user.email).toBe(user.email)

  await openAccountMenu(page, user.email)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/auth\/login/)
  await expectStatus(await me(page), 401)
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/auth\/login/)
})

test('wrong code: rejected without a session, then the real code still works', async ({ page }) => {
  const code = await requestLoginCode(page, user.email)
  const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0')
  await enterLoginCode(page, wrong)
  await expect(page.getByText('Invalid or expired code').first()).toBeVisible()
  await expect(page).toHaveURL(/\/auth\/login/)
  await expectStatus(await me(page), 401)

  await enterLoginCode(page, code)
  await expect(page).toHaveURL(/\/dashboard$/)
  await expectStatus(await me(page), 200)
})

test('2fa: enroll, login requires a TOTP, and a backup code works exactly once', async ({ page, browser, baseURL }) => {
  // Enroll from the security settings page with a normal session.
  await signInUser(page, user.id, baseURL!)
  await page.goto('/settings/security')
  await expect(page.getByRole('heading', { name: 'Two-Factor Authentication' })).toBeVisible()
  const setupResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/auth/2fa/setup')
  await page.getByRole('button', { name: 'Enable 2FA' }).click()
  const setup = (await (await setupResponse).json()) as { secret: string; backupCodes: string[] }
  expect(setup.backupCodes).toHaveLength(10)
  await expect(page.getByText(setup.secret, { exact: true })).toBeVisible()
  const enrolledAt = Date.now()
  await page.getByPlaceholder('000000').fill(totp(setup.secret))
  await page.getByRole('button', { name: 'Verify & Enable' }).click()
  await expect(page.getByText('Enabled', { exact: true })).toBeVisible()
  expect((await userSecurityState(user.id)).twoFactorEnabled).toBe(true)
  // The backup codes are emailed to the account as well.
  expect((await waitForEmail(user.email, /Backup Codes/, enrolledAt)).text).toContain(setup.backupCodes[0])
  // Enabling 2FA revoked every session issued before it, except this browser's refreshed one.
  await expectStatus(await me(page), 200)

  // A fresh login now stops at the second factor.
  const login = await browser.newContext()
  const loginPage = await login.newPage()
  await useFreshClientAddress(loginPage)
  await enterLoginCode(loginPage, await requestLoginCode(loginPage, user.email))
  await expect(loginPage.getByRole('heading', { name: 'Two-factor authentication' })).toBeVisible()
  await expectStatus(await me(loginPage), 401)
  // The next time step: the setup code's step can never be replayed.
  await loginPage.getByLabel('Authenticator or backup code').fill(totp(setup.secret, 30))
  await loginPage.getByRole('button', { name: 'Verify and sign in' }).click()
  await expect(loginPage).toHaveURL(/\/dashboard$/)
  await expectStatus(await me(loginPage), 200)
  await login.close()

  // A backup code signs in once; replaying it with the same challenge fails.
  const backup = await browser.newContext()
  const backupPage = await backup.newPage()
  await useFreshClientAddress(backupPage)
  await enterLoginCode(backupPage, await requestLoginCode(backupPage, user.email))
  await expect(backupPage.getByRole('heading', { name: 'Two-factor authentication' })).toBeVisible()
  const challenge = (await backup.cookies()).find((cookie) => cookie.name === 'two_factor_challenge')
  expect(challenge).toBeTruthy()
  await backupPage.getByLabel('Authenticator or backup code').fill(setup.backupCodes[0])
  await backupPage.getByRole('button', { name: 'Verify and sign in' }).click()
  await expect(backupPage).toHaveURL(/\/dashboard$/)
  expect(JSON.parse((await userSecurityState(user.id)).backupCodes || '[]')).toHaveLength(9)
  await backup.close()

  const replay = await replayContext(browser, baseURL!, challenge!.value)
  const reused = await replay.request.post('/api/auth/2fa/validate', {
    data: { code: setup.backupCodes[0] },
    headers: { origin: baseURL!, referer: `${baseURL}/auth/login` },
  })
  await expectStatus(reused, 400)
  expect((await reused.json()).code).toBe('INVALID_CODE')
  await expectStatus(await replay.request.get('/api/auth/me'), 401)
  await replay.close()
})

async function replayContext(browser: Browser, baseURL: string, challenge: string) {
  const context = await browser.newContext()
  await context.addCookies([
    {
      name: 'two_factor_challenge',
      value: challenge,
      domain: new URL(baseURL).hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  return context
}

test('log out everywhere: ends the session in every other browser', async ({ page, browser, baseURL }) => {
  const other = await browser.newContext()
  const otherPage = await other.newPage()
  await signInUser(otherPage, user.id, baseURL!)
  await expectStatus(await me(otherPage), 200)

  await signInUser(page, user.id, baseURL!)
  await page.goto('/settings/security')
  await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible()
  const before = (await userSecurityState(user.id)).tokenVersion
  await page.getByRole('button', { name: 'Log out everywhere' }).click()
  await page.getByRole('alertdialog', { name: 'Log out everywhere' }).getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(/\/auth\/login/)
  expect((await userSecurityState(user.id)).tokenVersion).toBe(before + 1)

  // The other browser still holds its cookie, but every API rejects it. (The
  // edge proxy only checks the signature, so page navigations are not
  // redirected until the client sees the 401; see docs/testing/e2e-matrix.md.)
  await expectStatus(await me(otherPage), 401)
  await expectStatus(await otherPage.request.get('/api/dashboard/context'), 401)
  await expectStatus(await otherPage.request.get('/api/vehicles'), 401)
  await other.close()
})
