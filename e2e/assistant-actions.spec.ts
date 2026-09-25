import { test, expect } from '@playwright/test'
import { SignJWT } from 'jose'

test('truthful summary and finding-based write use accessible previews at 375px', async ({ page, baseURL }) => {
  test.skip(
    !baseURL || !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(baseURL),
    'Local deterministic fixture only'
  )
  const origin = new URL(baseURL!)
  const token = await new SignJWT({ sub: 'e2e-user', email: 'qa@fleetvera.test', role: 'MANAGER' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(process.env.JWT_SECRET || 'dev-only-placeholder-not-for-production'))
  await page
    .context()
    .addCookies([{ name: 'token', value: token, domain: origin.hostname, path: '/', httpOnly: true, sameSite: 'Lax' }])
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        user: {
          id: 'e2e-user',
          email: 'qa@fleetvera.test',
          name: 'QA Manager',
          role: 'MANAGER',
          onboardingCompleted: true,
        },
      },
    })
  )
  await page.route('**/api/notifications**', (route) => route.fulfill({ json: { data: [] } }))
  await page.route(/\/api\/(vehicles|deliveries|maintenance|sop|clients)(\?.*)?$/, (route) =>
    route.fulfill({ json: { data: [] } })
  )
  await page.route('**/api/intelligence/data-quality', (route) =>
    route.fulfill({
      json: { issues: [], summary: { total: 0 }, coverage: { complete: true }, generatedAt: new Date().toISOString() },
    })
  )
  await page.route('**/api/dashboard/context', (route) =>
    route.fulfill({
      json: {
        role: 'MANAGER',
        dashboardRole: 'admin',
        onboardingCompleted: true,
        decisions: ['Review risks', 'Confirm assignments', 'Plan maintenance'],
        actions: [
          { label: 'Review fleet risks', href: '/intelligence' },
          { label: 'Add vehicle', href: '/vehicles' },
          { label: 'Manage team', href: '/team' },
        ],
        sources: {
          vehicles: { available: true, items: [], total: 0 },
          deliveries: { available: true, items: [], total: 0 },
          maintenance: { available: true, items: [], total: 0 },
        },
      },
    })
  )
  await page.route('**/api/assistant/entities?type=delivery', (route) =>
    route.fulfill({ json: { entities: [{ id: 'd1', label: 'QA Delivery' }] } })
  )
  await page.route('**/api/deliveries/d1', (route) =>
    route.fulfill({
      json: {
        id: 'd1',
        customer: 'QA Delivery',
        address: '1 QA St',
        status: 'pending',
        notes: 'Old',
        driver: '',
        items: 1,
        progress: 0,
      },
    })
  )
  const timestamp = '2026-08-08T12:00:00.000Z'
  await page.route('**/api/intelligence/brief', (route) =>
    route.fulfill({
      json: {
        findings: [
          {
            id: 'f1',
            type: 'delivery-schedule-passed',
            severity: 'high',
            confidence: 1,
            score: 100,
            title: 'Late QA delivery',
            explanation: 'Scheduled time passed.',
            evidence: [{ entityType: 'delivery', entityId: 'd1', field: 'updatedAt', value: timestamp, timestamp }],
            evidenceValid: true,
            evidenceTotal: 1,
            evidenceTruncated: false,
            action: 'Review delivery',
            actionUrl: '/deliveries?record=d1',
            feedback: null,
            status: 'OPEN',
            effectiveStatus: 'OPEN',
            generatedAt: timestamp,
            expiresAt: null,
          },
        ],
        totalOpen: 1,
        generatedAt: timestamp,
        stale: false,
        coverage: { complete: true, sourceTruncated: false, evidenceComplete: true },
        capabilities: { refresh: true, manage: true, feedback: true },
      },
    })
  )
  let writePreviewed = false,
    confirmed = false
  await page.route('**/api/assistant/actions/execute', async (route) => {
    const body = route.request().postDataJSON()
    if (body.action?.type === 'draft_weekly_summary')
      return route.fulfill({
        json: {
          requiresConfirmation: false,
          provenanceToken: 'signed-read',
          preview: {
            kind: 'read',
            label: 'Draft weekly fleet summary',
            before: {},
            after: { vehicles: 3, persistence: 'Not saved; copy this draft.' },
          },
        },
      })
    if (body.action?.type === 'open_edit')
      return route.fulfill({
        json: {
          requiresConfirmation: false,
          provenanceToken: 'signed-edit',
          href: '/deliveries?edit=d1&status=delivered',
          preview: {
            kind: 'navigation',
            label: 'Open delivery edit screen',
            before: { status: 'pending' },
            after: { status: 'delivered' },
          },
        },
      })
    if (body.action?.type === 'update_delivery_status') {
      expect(body.sourceFindingId).toBe('f1')
      writePreviewed = true
      return route.fulfill({
        json: {
          requiresConfirmation: true,
          token: 'signed-write',
          preview: {
            kind: 'write',
            label: 'Apply suggested delivery status',
            before: { status: 'pending', notes: null },
            after: { status: body.action.values.status, notes: null },
          },
        },
      })
    }
    expect(body).toEqual({ previewToken: 'signed-write', confirm: true })
    confirmed = true
    return route.fulfill({ json: { executed: true } })
  })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/assistant')
  await page.getByRole('button', { name: 'Preview suggested action' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Draft weekly fleet summary' })).toBeFocused()
  await expect(page.getByText('Not saved; copy this draft.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm this change' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Copy draft' })).toBeVisible()
  await page.goto('/dashboard')
  const card = page.getByRole('heading', { name: 'Late QA delivery' }).locator('xpath=ancestor::article')
  await card.getByLabel('Delivery status').selectOption('delivered')
  await card.getByRole('button', { name: 'Preview suggested action' }).click()
  await expect(card.getByRole('heading', { name: 'Apply suggested delivery status' })).toBeFocused()
  expect(writePreviewed).toBe(true)
  await card.getByRole('button', { name: 'Confirm this change' }).click()
  await expect(card.getByRole('status')).toContainText('confirmed', { timeout: 15_000 })
  expect(confirmed).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true
  )
  await page.goto('/assistant')
  await page.getByLabel('Record type').selectOption('delivery')
  await page.getByRole('button', { name: 'Load authorized records' }).click()
  await page.getByLabel('Authorized record').selectOption('d1')
  await page.getByLabel('Prefill delivery status').selectOption('delivered')
  const edit = page.getByRole('button', { name: 'Preview suggested action' }).first()
  await edit.click()
  await expect(page.getByRole('heading', { name: 'Open delivery edit screen' })).toBeFocused()
  await expect(page.getByLabel('Before').getByText('pending')).toBeVisible()
  await expect(page.getByLabel('After').getByText('delivered')).toBeVisible()
  await page.getByRole('link', { name: 'Open edit screen' }).click()
  const form = page.getByRole('dialog', { name: 'Edit Delivery' })
  await expect(form).toBeVisible()
  await expect(form.getByRole('button', { name: 'Delivered', exact: true })).toHaveClass(/border-current/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true
  )
})
