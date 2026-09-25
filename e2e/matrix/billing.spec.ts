import { expect, test } from '@playwright/test'
import { disconnectMatrixDb, expectStatus, signIn } from './support'

/*
 * Free-beta plan state. Paid plans are deferred, so the CI server has no Stripe
 * configuration: pricing advertises the free beta, checkout is never offered,
 * and the availability endpoint reports billing as unavailable. The per-role
 * /billing notice and /api/subscription/status access are asserted in
 * roles.spec.ts; checkout access per role in features.spec.ts.
 * Stripe-configured states (checkout -> active -> past_due -> canceled) need
 * Stripe test mode and are not simulated here (docs/testing/e2e-matrix.md).
 */
test.afterAll(disconnectMatrixDb)

test('pricing advertises the free beta without a checkout path', async ({ page }) => {
  const response = await page.goto('/pricing')
  expect(response?.ok()).toBe(true)
  await expect(page.getByRole('heading', { level: 1, name: 'Free during the beta' })).toBeVisible()
  await expect(page.getByText('No payment details are needed during the beta.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in to Fleetvera' })).toHaveAttribute('href', '/auth/login')
  await expect(page.getByRole('button', { name: /Subscribe|Checkout|Upgrade|Buy/i })).toHaveCount(0)
  await expect(page.locator('a[href*="checkout"], a[href*="stripe.com"]')).toHaveCount(0)
})

test('billing availability reports unavailable with no pricing', async ({ request }) => {
  const response = await request.get('/api/stripe/availability')
  await expectStatus(response, 200)
  expect(await response.json()).toEqual({
    available: false,
    pricing: null,
    message: 'Online subscription management is temporarily unavailable. Contact support for help.',
  })
})

test('owner billing page shows the free-beta plan and no checkout or cancel controls', async ({ page, baseURL }) => {
  await signIn(page, 'OWNER', baseURL!)
  const status = await page.request.get('/api/subscription/status')
  await expectStatus(status, 200)
  const response = await page.goto('/billing')
  expect(response?.ok()).toBe(true)
  await expect(page.getByRole('heading', { level: 1, name: 'Billing & Subscription' })).toBeVisible()
  await expect(page.getByText('Fleetvera is free during the beta')).toBeVisible()
  await expect(page.getByText(/Billing is managed by your workspace owner or admin/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Subscribe|Upgrade|Checkout|Cancel Subscription/i })).toHaveCount(0)
})

test('unauthenticated billing and checkout requests are refused', async ({ request, baseURL }) => {
  await expectStatus(await request.get('/api/subscription/status'), 401)
  await expectStatus(await request.post('/api/stripe/checkout-session', { data: { interval: 'monthly' }, headers: { origin: baseURL!, referer: `${baseURL}/pricing` } }), 401)
})
