import { expect, test } from '@playwright/test'
import { SignJWT } from 'jose'

test('maintenance attention is explainable, keyboard usable, and fits 375px', async ({ page, baseURL }) => {
  test.setTimeout(60_000)
  test.skip(!baseURL || !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(baseURL), 'Deterministic auth fixture is restricted to a local Fleetvera server')
  const origin = new URL(baseURL!)
  const token = await new SignJWT({ sub: 'risk-qa', email: 'risk@fleetvera.test', role: 'OWNER' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(process.env.JWT_SECRET || 'dev-only-placeholder-not-for-production'))
  await page.context().addCookies([{ name: 'token', value: token, domain: origin.hostname, path: '/', httpOnly: true, sameSite: 'Lax' }])
  const consoleErrors: string[] = []
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  await page.route('**/api/auth/me', route => route.fulfill({ json: { user: { id: 'risk-qa', email: 'risk@fleetvera.test', name: 'Risk QA', role: 'OWNER', onboardingCompleted: true } } }))
  await page.route('**/api/notifications**', route => route.fulfill({ json: { notifications: [], data: [] } }))
  await page.route('**/api/subscription/status**', route => route.fulfill({ json: { subscription: null } }))
  await page.route('**/api/team/workspaces**', route => route.fulfill({ json: { workspaces: [] } }))
  let feedbackBody: Record<string, unknown> | null = null; const idempotencyKeys: string[] = []; let saveAttempts = 0; let withdrawn = false
  await page.route('**/api/intelligence/maintenance-risk-feedback', route => {
    if (route.request().method() === 'DELETE') { withdrawn = true; return route.fulfill({ json: { withdrawn: true } }) }
    feedbackBody = route.request().postDataJSON(); idempotencyKeys.push(route.request().headers()['idempotency-key']); saveAttempts += 1
    return saveAttempts === 1 ? route.fulfill({ status: 200, contentType: 'application/json', body: 'invalid-json-simulates-lost-response' }) : route.fulfill({ status: 200, json: { feedback: { id: 'pilot-1' }, replayed: true } })
  })
  await page.route('**/api/analytics/dashboard**', route => route.fulfill({ json: {
    stats: { fleetUtilization: { current: 50, total: 2, active: 1 }, deliveries: { total: 0, delivered: 0, inTransit: 0, pending: 0, delayed: 0 }, maintenance: { total: 1, overdue: 1, dueSoon: 0, completed: 0, totalCost: 0, upcoming: [] }, clients: { total: 0 } },
    charts: { activityOverTime: [], maintenanceByCategory: [], vehicleUtilization: [] },
    maintenanceRisk: { evaluatedVehicles: 1, coverage: { vehiclesComplete: true, tasksComplete: true }, items: [{
      vehicleId: 'v1', vehicleName: 'Service Van 1', score: 55, band: 'high', wording: 'High maintenance attention based on recorded operational indicators.',
      factors: [{ code: 'overdue-maintenance', label: 'Overdue maintenance', points: 30, evidence: 'One open task is 31 full days overdue.', sourceIds: ['t1'], links: ['/maintenance?record=t1'] }],
      missingData: ['Valid mileage at last service is unavailable.'], completeness: { available: 6, expected: 7, percent: 86 }, rubricVersion: 'maintenance-risk-v1', generatedAt: '2026-08-08T00:00:00.000Z', sourceComplete: true,
    }] },
  } }))
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/analytics')
  await expect(page.getByRole('heading', { name: 'Maintenance attention' })).toBeVisible()
  const disclosure = page.getByRole('button', { name: /Service Van 1.*55 points.*high/i })
  await disclosure.focus()
  await page.keyboard.press('Enter')
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText(/not a failure prediction/i)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Source 1' })).toHaveAttribute('href', '/maintenance?record=t1')
  await page.getByRole('button', { name: 'Helpful', exact: true }).click()
  await page.getByRole('checkbox', { name: /I consent/i }).check()
  await page.getByRole('button', { name: 'Save pilot feedback' }).click()
  await expect(page.getByText(/Save status unknown/i)).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Save pilot feedback' }).click()
  await expect(page.getByText('Pilot feedback saved.')).toBeVisible()
  expect(feedbackBody).toMatchObject({ vehicleId: 'v1', helpful: true, actionTaken: false, consent: true })
  expect(idempotencyKeys[0]).toBe(idempotencyKeys[1])
  await page.getByRole('button', { name: 'Withdraw pilot feedback' }).click(); await expect(page.getByText('Pilot feedback withdrawn.')).toBeVisible(); expect(withdrawn).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  expect((await page.locator('body').innerText())).not.toMatch(/probability|failure chance/i)
  expect(consoleErrors).toEqual([])
  await page.screenshot({ path: 'test-results/maintenance-risk-375.png', fullPage: true })
})
