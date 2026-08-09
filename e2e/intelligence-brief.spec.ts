import { test, expect } from '@playwright/test'
import { SignJWT } from 'jose'

test('authenticated intelligence brief supports the daily attention workflow at 375px', async ({ page, baseURL }) => {
  test.skip(!baseURL || !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(baseURL), 'Deterministic auth fixture is restricted to a local Fleetvera server')
  const origin = new URL(baseURL!)
  const token = await new SignJWT({ sub: 'e2e-user', email: 'qa@fleetvera.test', role: 'OWNER' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(process.env.JWT_SECRET || 'dev-only-placeholder-not-for-production'))
  await page.context().addCookies([{ name: 'token', value: token, domain: origin.hostname, path: '/', httpOnly: true, sameSite: 'Lax' }])

  const finding = {
    id: 'e2e-finding', type: 'delivery-late', severity: 'high', confidence: 0.95, score: 500,
    title: 'Late delivery needs attention', explanation: 'The scheduled time has passed.',
    evidence: [{ entityType: 'delivery', entityId: 'delivery-1', field: 'scheduledTime', value: '2026-08-08T12:00:00Z', timestamp: '2026-08-08T12:00:00Z' }],
    evidenceValid: true, evidenceTotal: 1, evidenceTruncated: false,
    action: 'Review delivery', actionUrl: '/deliveries?record=delivery-1', feedback: null,
    generatedAt: new Date().toISOString(), expiresAt: null,
    status: 'OPEN', effectiveStatus: 'OPEN',
  }
  const secondFinding = {
    ...finding,
    id: 'e2e-finding-second',
    score: 400,
    title: 'Vehicle inspection is overdue',
    explanation: 'The inspection date has passed.',
    action: 'Review vehicle',
    actionUrl: '/vehicles?record=vehicle-2',
    evidence: [{ entityType: 'vehicle', entityId: 'vehicle-2', field: 'status', value: 'inspection overdue', timestamp: null }],
  }
  const dismissedIds = new Set<string>()
  let savedFeedback: string | null = null
  let dismissAttempts = 0
  const emptyCollection = { data: [] }
  await page.route('**/api/auth/me', route => route.fulfill({ json: { user: { id: 'e2e-user', email: 'qa@fleetvera.test', name: 'QA Owner', role: 'OWNER', onboardingCompleted: true } } }))
  await page.route('**/api/dashboard/context', route => route.fulfill({ json: { role: 'OWNER', dashboardRole: 'admin', onboardingCompleted: true, decisions: ['Review risks', 'Confirm assignments', 'Plan maintenance'], actions: [{ label: 'Review fleet risks', href: '/intelligence' }, { label: 'Add vehicle', href: '/vehicles' }, { label: 'Manage team', href: '/team' }], sources: { vehicles: { available: true, items: [], total: 0 }, deliveries: { available: true, items: [], total: 0 }, maintenance: { available: true, items: [], total: 0 } } } }))
  await page.route(/\/api\/(vehicles|deliveries|maintenance|sop|clients)(\?.*)?$/, route => route.fulfill({ json: emptyCollection }))
  await page.route('**/api/intelligence/data-quality', route => route.fulfill({ json: { issues: [], summary: { total: 0, bySeverity: {}, byEntity: {}, countsComplete: true }, coverage: { complete: true, sourceTruncated: false, issuesTruncated: false }, generatedAt: new Date().toISOString() } }))
  await page.route('**/api/intelligence/brief', route => {
    const findings = [{ ...finding, feedback: savedFeedback }, secondFinding].filter(item => !dismissedIds.has(item.id))
    return route.fulfill({ json: { findings, totalOpen: findings.length, generatedAt: new Date().toISOString(), stale: false, coverage: { complete: true, sourceTruncated: false, evidenceComplete: true }, capabilities: { refresh: true, manage: true, feedback: true } } })
  })
  await page.route('**/api/intelligence/findings', async route => {
    const request = route.request()
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON() as { id: string; action: string }
      if (body.action === 'HELPFUL' || body.action === 'NOT_HELPFUL') savedFeedback = body.action
      if (body.action === 'DISMISS') {
        dismissAttempts += 1
        if (dismissAttempts === 2) {
          await new Promise(resolve => setTimeout(resolve, 300))
          return route.fulfill({ status: 500, json: { error: 'postgres password=raw-secret connection failed' } })
        }
        dismissedIds.add(body.id)
      }
      return route.fulfill({ json: { finding: { ...finding, feedback: body.action === 'HELPFUL' ? 'HELPFUL' : null } } })
    }
    return route.fulfill({ json: { generatedAt: new Date().toISOString() } })
  })
  await page.route('**/api/notifications**', route => route.fulfill({ json: emptyCollection }))

  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/dashboard')
  const heading = page.getByRole('heading', { name: 'What needs attention today' })
  await expect(heading).toBeVisible()
  const firstCard = page.getByRole('heading', { name: finding.title }).locator('xpath=ancestor::article')
  await expect(firstCard).toBeVisible()
  await expect(firstCard.getByText('High urgency')).toBeVisible()

  const disclosure = firstCard.getByRole('button', { name: 'Why am I seeing this?' })
  await disclosure.focus()
  await page.keyboard.press('Enter')
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true')
  await expect(firstCard.getByRole('link', { name: 'Open delivery record' })).toHaveAttribute('href', '/deliveries?record=delivery-1')
  await expect(firstCard.getByRole('link', { name: 'Review delivery' })).toHaveAttribute('href', '/deliveries?record=delivery-1')

  const helpful = page.getByRole('button', { name: `Mark ${finding.title} helpful` })
  await helpful.click()
  await expect(helpful).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 })
  await expect(helpful).toBeEnabled()
  await page.getByRole('button', { name: `Dismiss ${finding.title}` }).click()
  await expect(page.getByRole('heading', { name: finding.title })).toHaveCount(0)
  await expect(page.getByText('Finding dismissed.')).toBeVisible()
  const secondCard = page.getByRole('heading', { name: secondFinding.title }).locator('xpath=ancestor::article')
  await expect(secondCard).toBeFocused()

  await page.getByRole('button', { name: `Dismiss ${secondFinding.title}` }).click()
  await expect(page.getByRole('heading', { name: secondFinding.title })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: secondFinding.title })).toBeVisible()
  await expect(page.getByText('Could not dismiss. The finding was restored; try again.')).toBeVisible()
  await expect(page.getByText(/postgres password=raw-secret/i)).toHaveCount(0)
  await expect(secondCard).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})
