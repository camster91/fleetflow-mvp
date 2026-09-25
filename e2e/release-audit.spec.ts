import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

type AxeViolation = { id: string; impact: string | null; help: string; nodes: unknown[] }
type AxeWindow = Window &
  typeof globalThis & {
    axe: { run(root: Document, options: object): Promise<{ violations: AxeViolation[] }> }
  }

const axePath = path.join(process.cwd(), 'node_modules', 'axe-core', 'axe.min.js')
const viewports = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]

async function seriousAccessibilityViolations(page: Page) {
  await page.addScriptTag({ path: axePath })
  const result = await page.evaluate(async () =>
    (window as AxeWindow).axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    })
  )
  return result.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
}

test('public entry points remain accessible and bounded at release viewports', async ({ page }) => {
  const consoleErrors: string[] = []
  const unauthorizedPaths: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('response', (response) => {
    if (response.status() === 401) unauthorizedPaths.push(new URL(response.url()).pathname)
  })

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(page).toHaveTitle(/Fleetvera/)
    await expect(page.locator('body')).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(overflow, `${viewport.width}px viewport has horizontal overflow`).toBe(false)
  }

  expect(unauthorizedPaths.every((pathname) => pathname === '/api/auth/me')).toBe(true)
  const unexpectedConsoleErrors = consoleErrors.filter(
    (message) =>
      !(message.includes('status of 401') && unauthorizedPaths.every((pathname) => pathname === '/api/auth/me')) &&
      !(message.includes('downloadable font: download failed') && message.includes('fonts.gstatic.com'))
  )
  expect(unexpectedConsoleErrors).toEqual([])
  expect(await seriousAccessibilityViolations(page)).toEqual([])
})

test('public internal links, login form, and PWA manifest are release-safe', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'One browser is sufficient for HTTP and manifest contracts')
  await page.goto('/')
  const hrefs = await page
    .locator('a[href^="/"]')
    .evaluateAll((links) => [
      ...new Set(links.map((link) => link.getAttribute('href')).filter((href): href is string => Boolean(href))),
    ])
  for (const href of hrefs) {
    const response = await request.get(href)
    expect(response.status(), `${href} returned ${response.status()}`).toBeLessThan(400)
  }

  await page.goto('/auth/login')
  await expect(page.locator('input')).not.toHaveCount(0)
  expect(await seriousAccessibilityViolations(page)).toEqual([])

  const manifestResponse = await request.get('/manifest.json')
  expect(manifestResponse.ok()).toBe(true)
  const manifest = (await manifestResponse.json()) as {
    name?: string
    display?: string
    icons?: Array<{ sizes?: string }>
  }
  expect(manifest.name).toContain('Fleetvera')
  expect(manifest.display).toBeTruthy()
  expect(manifest.icons?.some((icon) => icon.sizes?.includes('192'))).toBe(true)
  expect(manifest.icons?.some((icon) => icon.sizes?.includes('512'))).toBe(true)
})
