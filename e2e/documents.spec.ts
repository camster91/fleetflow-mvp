import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 375, height: 812 } })

test('document review is usable on mobile and cancellation does not confirm', async ({ page }) => {
  let uploaded = false; let confirmed = 0
  const row = { id: 'd1', originalName: 'invoice.pdf', mimeType: 'application/pdf', status: 'EXTRACTED', revision: 2, expiresAt: '2026-09-07T00:00:00Z', extraction: { documentType: 'service_invoice', fields: { vendor: { value: 'Honest Garage', confidence: .98, citationIds: ['c1'] }, date: { value: '2026-08-08', confidence: .95, citationIds: ['c2'] }, total: { value: 120, confidence: .55, citationIds: ['c3'] } }, services: [{ description: 'Oil change', quantity: 1, amount: 80, confidence: .9, citationIds: ['c1'] }], parts: [], citations: [{ id: 'c1', page: 1, quote: 'Honest Garage' }, { id: 'c2', page: 1, quote: '2026-08-08' }, { id: 'c3', page: 1, quote: '120' }], warnings: [] } }
  await page.route('**/api/auth/session', route => route.fulfill({ json: { user: { id: 'u1', name: 'Manager', onboardingCompleted: true } }, status: 200 }))
  await page.route('**/api/documents/upload**', async route => {
    const request = route.request()
    if (request.method() === 'POST') { uploaded = true; return route.fulfill({ status: 201, json: { document: row, duplicate: false } }) }
    if (request.method() === 'DELETE') { uploaded = false; return route.fulfill({ status: 204, body: '' }) }
    if (request.url().includes('?id=')) return route.fulfill({ status: 200, contentType: 'application/pdf', body: Buffer.from('%PDF-1.7\n%%EOF') })
    return route.fulfill({ json: { documents: uploaded ? [row] : [] } })
  })
  await page.route('**/api/documents/d1/extract', async route => {
    const body = route.request().postDataJSON()
    if (body.action === 'preview') return route.fulfill({ json: { previewToken: 'signed-preview-token-that-is-long-enough', before: null, after: body.draft, warning: 'No fleet record changes until you confirm.' } })
    if (body.action === 'confirm') { confirmed += 1; return route.fulfill({ json: { result: { entityType: 'expense', entityId: 'e1' } } }) }
    if (body.action === 'save_draft') { row.extraction = body.extraction; row.revision += 1; return route.fulfill({ json: { revision: row.revision } }) }
    return route.fulfill({ json: { extraction: row.extraction, revision: 2 } })
  })
  await page.goto('/documents')
  await page.locator('#document-upload').setInputFiles({ name: 'invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\n%%EOF') })
  await expect(page.getByRole('heading', { name: 'Review extracted draft' })).toBeVisible()
  await expect(page.locator('#document-upload')).toBeEnabled()
  await expect(page.getByText(/Low confidence: total/)).toBeVisible()
  await page.getByLabel('vendor').fill('Corrected Garage')
  await page.getByRole('button', { name: 'Add part' }).click()
  await page.getByLabel('part 1').fill('Oil filter')
  await page.getByLabel('Quantity').last().fill('2')
  await page.getByLabel('Amount').last().fill('18.50')
  await page.getByRole('button', { name: 'Save reviewed draft' }).click()
  await expect(page.getByLabel('vendor')).toHaveValue('Corrected Garage')
  await expect(page.getByLabel('part 1')).toHaveValue('Oil filter')
  await expect(page.getByLabel('Quantity').last()).toHaveValue('2'); await expect(page.getByLabel('Amount').last()).toHaveValue('18.50')
  await page.getByLabel('Vehicle record ID').fill('v1')
  await page.getByRole('textbox', { name: /^total/i }).fill('')
  await page.getByRole('button', { name: 'Preview expense' }).click()
  await expect(page.getByRole('status')).toContainText('Vendor and total are required')
  await page.getByRole('textbox', { name: /^total/i }).fill('120')
  await page.getByRole('button', { name: 'Preview expense' }).click()
  const expenseDialog = page.getByRole('dialog', { name: 'Confirm exact proposed expense' }); await expect(expenseDialog).toBeVisible(); await expect(expenseDialog).toContainText('Corrected Garage'); await expect(expenseDialog).toContainText('120')
  await expenseDialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('status')).toContainText('Cancelled')
  expect(confirmed).toBe(0)
  await page.getByRole('button', { name: 'Preview maintenance task' }).click()
  const maintenanceDialog = page.getByRole('dialog', { name: 'Confirm exact proposed maintenance' }); await expect(maintenanceDialog).toBeVisible(); await maintenanceDialog.getByRole('button', { name: 'Confirm creation' }).click()
  await expect(page.getByRole('status')).toContainText('Maintenance task created')
  expect(confirmed).toBe(1)
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Delete document' }).click()
  await expect(page.getByRole('status')).toContainText('Document deleted')
  await expect(page.locator('section[aria-labelledby="document-upload-label"]')).toBeFocused()
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll')
})
