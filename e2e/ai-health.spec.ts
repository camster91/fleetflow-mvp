import { expect, test } from '@playwright/test'
import { SignJWT } from 'jose'

for (const viewport of ['desktop', '375px'] as const)
  test(`AI health controls remain accessible and bounded at ${viewport}`, async ({ page }) => {
    test.setTimeout(60_000)
    if (viewport === '375px') await page.setViewportSize({ width: 375, height: 812 })
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required for AI health browser QA')
    const baseURL = test.info().project.use.baseURL as string
    const origin = new URL(baseURL)
    const token = await new SignJWT({ sub: 'qa-admin', email: 'qa@fleetvera.test', role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET))
    await page
      .context()
      .addCookies([
        { name: 'token', value: token, domain: origin.hostname, path: '/', httpOnly: true, sameSite: 'Lax' },
      ])
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: {
          user: {
            id: 'qa-admin',
            email: 'qa@fleetvera.test',
            name: 'QA Admin',
            role: 'admin',
            onboardingCompleted: true,
          },
        },
      })
    )
    await page.route('**/api/team/workspaces**', (route) => route.fulfill({ json: { workspaces: [] } }))
    await page.route('**/api/subscription/status**', (route) => route.fulfill({ json: { subscription: null } }))
    await page.route('**/api/notifications**', (route) => route.fulfill({ json: { data: [] } }))
    await page.route('**/api/admin/ai-health', (route) =>
      route.fulfill({
        json: {
          status: 'enabled',
          provider: 'openai',
          modelVersion: 'gpt-safe@v1',
          configVersion: 2,
          retentionDays: 30,
          requests: 3,
          averageLatencyMs: 200,
          fallbackRate: 1 / 3,
          inputTokens: 20,
          outputTokens: 10,
          errors: [{ code: 'timeout', count: 1 }],
          evaluation: { version: 'fixtures@v1', passed: true, runAt: '2026-08-08T01:00:00.000Z' },
        },
      })
    )
    let mutation: unknown
    await page.route('**/api/admin/ai-settings', async (route) => {
      mutation = route.request().postDataJSON()
      await route.fulfill({
        json: {
          enabled: false,
          killSwitch: true,
          retentionDays: 7,
          provider: 'openai',
          modelVersion: 'gpt-safe@v1',
          configVersion: 3,
        },
      })
    })
    await page.goto('/admin/ai-health')
    await expect(page.getByRole('heading', { name: 'AI health' })).toBeVisible()
    await expect(page.getByText('Enabled')).toBeVisible()
    await expect(page.getByText(/fixtures@v1/)).toBeVisible()
    await page.getByRole('checkbox', { name: 'Enable AI for this workspace' }).uncheck()
    await page.getByRole('checkbox', { name: 'Emergency workspace kill switch' }).check()
    await page.getByLabel('Telemetry retention days').selectOption('7')
    await page.getByRole('button', { name: 'Save AI controls' }).click()
    await expect(page.getByText('Killed')).toBeVisible()
    expect(mutation).toEqual({ enabled: false, killSwitch: true, retentionDays: 7, expectedConfigVersion: 2 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(
      false
    )
  })
