import { expect, test } from '@playwright/test'
import { createSyntheticUser, disconnectMatrixDb, matrixDb, signInUser } from './support'

/* Platform admins see live launch checks and record backup evidence and the go/no-go decision. */
test.afterAll(disconnectMatrixDb)

test('launch readiness: admin records evidence and a decision; others are refused', async ({ page, baseURL }) => {
  const admin = await createSyntheticUser('launch-admin')
  await matrixDb.user.update({ where: { id: admin.id }, data: { role: 'admin' } })
  const customer = await createSyntheticUser('launch-customer')
  try {
    await signInUser(page, admin.id, baseURL!)
    await page.goto('/admin/launch')
    await expect(page.getByRole('heading', { name: 'Launch readiness', level: 1 })).toBeVisible()
    const checks = page.getByRole('region', { name: 'Checks' })
    await expect(checks.getByRole('heading', { name: 'Leaked secrets replaced' })).toBeVisible()
    await expect(checks.getByRole('heading', { name: 'Database and migrations' })).toBeVisible()

    const evidence = page.getByRole('region', { name: 'Record backup and monitoring evidence' })
    await evidence.getByLabel('Summary').fill('E2E synthetic backup drill')
    await evidence.getByLabel(/Checksum or ID/).fill('e2e-backup-0001')
    await evidence.getByRole('button', { name: 'Record evidence' }).click()
    await expect(evidence.getByRole('status')).toHaveText('Evidence recorded.')
    const history = page.getByRole('region', { name: 'History' })
    await expect(history.getByText('e2e-backup-0001')).toBeVisible()

    const decision = page.getByRole('region', { name: 'Go / no-go' })
    await decision.getByLabel('Reasoning and who agreed').fill('E2E: not ready yet')
    await decision.getByRole('button', { name: 'Record decision' }).click()
    await expect(decision.getByRole('status')).toHaveText('Decision recorded.')
    await expect(history.getByText('Go / no-go · No-go')).toBeVisible()

    await signInUser(page, customer.id, baseURL!)
    const refused = await page.request.get('/api/admin/launch')
    expect(refused.status()).toBe(403)
  } finally {
    await matrixDb.opsRecord.deleteMany({ where: { recordedById: admin.id } })
  }
})
