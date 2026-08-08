import { test, expect } from '@playwright/test'
import { SignJWT } from 'jose'

test('disposable PostgreSQL assistant path preserves scope, aliases, fallback, and source navigation', async ({ page, request, baseURL }) => {
  test.skip(process.env.REAL_SCOPED_QA !== '1' || !baseURL, 'Requires an explicitly seeded disposable PostgreSQL workspace')
  const origin = new URL(baseURL!); const token = await new SignJWT({ sub: 'task9-real-user', email: 'task9-real@fleetvera.test', role: 'OWNER' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET!)); await page.context().addCookies([{ name: 'token', value: token, domain: origin.hostname, path: '/', httpOnly: true, sameSite: 'Lax' }])
  await page.goto('/assistant'); await page.getByRole('button', { name: 'Which deliveries are late, incomplete, or unassigned?' }).click(); await expect(page.getByText(/Delivery task9-real-delivery is late/i)).toBeVisible(); await page.getByRole('link', { name: 'Source: Delivery task9-real-delivery' }).click(); await expect(page.getByRole('dialog', { name: 'Edit Delivery' })).toBeVisible()
  const alias = await request.post(`${baseURL}/api/ai/query`, { headers: { Cookie: `token=${token}`, Origin: baseURL! }, data: { question: 'Which vehicles have the highest recorded maintenance cost?' } }); expect(alias.ok()).toBe(true); const body = await alias.json(); expect(body.mode).toBe('deterministic'); expect(body.sources.some((item: { href: string }) => item.href.includes('/assistant/sources/maintenance-cost'))).toBe(true)
})
