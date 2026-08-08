import { test, expect } from '@playwright/test'
import { SignJWT } from 'jose'

test('Ask Fleetvera is cited, keyboard usable, cancellable, and fits 375px', async ({ page, baseURL }) => {
  test.skip(!baseURL || !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(baseURL), 'Deterministic fixture is restricted to a local Fleetvera server')
  const origin = new URL(baseURL!)
  const token = await new SignJWT({ sub: 'e2e-user', email: 'qa@fleetvera.test', role: 'VIEWER' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET || 'dev-only-placeholder-not-for-production'))
  await page.context().addCookies([{ name: 'token', value: token, domain: origin.hostname, path: '/', httpOnly: true, sameSite: 'Lax' }])
  await page.route('**/api/auth/me', route => route.fulfill({ json: { user: { id: 'e2e-user', email: 'qa@fleetvera.test', name: 'QA Viewer', role: 'VIEWER', onboardingCompleted: true } } }))
  await page.route('**/api/notifications**', route => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/assistant/entities?type=vehicle', route => route.fulfill({ json: { entities: [{ id: 'v1', label: 'QA Van' }] } }))
  await page.route(/\/api\/(deliveries|vehicles|clients)(\?.*)?$/, route => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/deliveries/d1', route => route.fulfill({ json: { id: 'd1', customer: 'QA Customer', address: '1 QA St', status: 'pending', driver: null, progress: 0, items: 1, scheduledTime: new Date().toISOString(), estimatedArrival: null } }))
  let queryCount = 0
  await page.route('**/api/assistant/query', async route => {
    queryCount += 1
    if (queryCount === 1) await new Promise(resolve => setTimeout(resolve, 1_000))
    return route.fulfill({ json: { mode: 'deterministic', empty: false, answer: { claims: [{ text: 'Delivery d1 is late.', citationIds: ['delivery:d1'] }] }, sources: [{ id: 'delivery:d1', type: 'delivery', recordId: 'd1', label: 'Delivery d1', href: '/deliveries?record=d1' }] } })
  })
  await page.setViewportSize({ width: 375, height: 812 }); await page.goto('/assistant')
  const prompt = page.getByRole('button', { name: 'Which deliveries are late, incomplete, or unassigned?' }); await prompt.focus(); await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Cancel' }).click(); await expect(page.getByRole('status')).toContainText('cancelled')
  await prompt.click(); await expect(page.getByText('Delivery d1 is late.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Source: Delivery d1' })).toHaveAttribute('href', '/deliveries?record=d1')
  await expect(page.getByText(/read-only/i)).toBeVisible()
  await page.getByRole('button', { name: 'Load authorized records' }).click(); await page.getByLabel('Authorized record').selectOption('v1'); await expect(page.getByRole('button', { name: 'Summarize selected vehicle' })).toBeEnabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.getByRole('link', { name: 'Source: Delivery d1' }).click(); await expect(page).toHaveURL(/\/deliveries/); await expect(page.getByRole('dialog', { name: 'Edit Delivery' })).toBeVisible()
})

test('maintenance aggregate citation visibly substantiates total and count at 375px', async ({ page, baseURL }) => {
  test.skip(!baseURL || !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(baseURL), 'Deterministic fixture is restricted to a local Fleetvera server')
  const origin = new URL(baseURL!); const token = await new SignJWT({ sub: 'e2e-user', email: 'qa@fleetvera.test', role: 'VIEWER' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET || 'dev-only-placeholder-not-for-production'))
  await page.context().addCookies([{ name: 'token', value: token, domain: origin.hostname, path: '/', httpOnly: true, sameSite: 'Lax' }])
  await page.route('**/api/auth/me', route => route.fulfill({ json: { user: { id: 'e2e-user', email: 'qa@fleetvera.test', name: 'QA Viewer', role: 'VIEWER', onboardingCompleted: true } } })); await page.route('**/api/notifications**', route => route.fulfill({ json: { data: [] } })); await page.route('**/api/assistant/sources/maintenance-cost?vehicle=v1', route => route.fulfill({ json: { vehicleId: 'v1', total: 500, count: 12, contributors: [{ id: 'm1', actualCost: 100, href: '/maintenance?record=m1' }], contributorsTruncated: true } }))
  await page.setViewportSize({ width: 375, height: 812 }); await page.goto('/assistant/sources/maintenance-cost?vehicle=v1'); await expect(page.getByText('$500.00')).toBeVisible(); await expect(page.getByText(/12 recorded maintenance entries/i)).toBeVisible(); await expect(page.getByRole('link', { name: /maintenance record m1/i })).toHaveAttribute('href', '/maintenance?record=m1'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('a cited record deleted before navigation fails closed in the real page resolver', async ({ page, baseURL }) => {
  test.skip(!baseURL || !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(baseURL), 'Deterministic fixture is restricted to a local Fleetvera server')
  const origin = new URL(baseURL!); const token = await new SignJWT({ sub: 'e2e-user', email: 'qa@fleetvera.test', role: 'VIEWER' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET || 'dev-only-placeholder-not-for-production'))
  await page.context().addCookies([{ name: 'token', value: token, domain: origin.hostname, path: '/', httpOnly: true, sameSite: 'Lax' }]); await page.route('**/api/auth/me', route => route.fulfill({ json: { user: { id: 'e2e-user', email: 'qa@fleetvera.test', name: 'QA Viewer', role: 'VIEWER', onboardingCompleted: true } } })); await page.route('**/api/notifications**', route => route.fulfill({ json: { data: [] } })); await page.route('**/api/assistant/query', route => route.fulfill({ json: { mode: 'deterministic', empty: false, answer: { claims: [{ text: 'Delivery gone is late.', citationIds: ['delivery:gone'] }] }, sources: [{ id: 'delivery:gone', type: 'delivery', recordId: 'gone', label: 'Delivery gone', href: '/deliveries?record=gone' }] } })); await page.route(/\/api\/(deliveries|vehicles|clients)(\?.*)?$/, route => route.fulfill({ json: { data: [] } })); await page.route('**/api/deliveries/gone', route => route.fulfill({ status: 404, json: { error: 'Not found' } }))
  await page.goto('/assistant'); await page.getByRole('button', { name: 'Which deliveries are late, incomplete, or unassigned?' }).click(); await page.getByRole('link', { name: 'Source: Delivery gone' }).click(); await expect(page.getByText('This record is unavailable or you no longer have access.')).toBeVisible(); await expect(page.getByRole('dialog', { name: 'Edit Delivery' })).toHaveCount(0)
})
