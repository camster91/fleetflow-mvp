const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const baseUrl = process.env.VISUAL_QA_BASE_URL || 'http://localhost:3300'
const userId = process.env.VISUAL_QA_USER_ID || 'qa-admin'
const userEmail = process.env.VISUAL_QA_USER_EMAIL || 'qa-admin@fleetflow.local'
const jwtSecret = process.env.VISUAL_QA_JWT_SECRET || 'local-visual-qa-secret-32-characters-minimum'

const output = path.join(__dirname, '..', 'qa-screenshots')
fs.mkdirSync(output, { recursive: true })

async function exercise(browser, name, viewport) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
      errors.push(`console: ${message.text()}`)
    }
  })
  page.on('pageerror', error => errors.push(`page: ${error.message}`))
  page.on('response', response => {
    if (response.status() >= 400) {
      const expectedAnonymousSession = response.status() === 401 && response.url().endsWith('/api/auth/me')
      if (!expectedAnonymousSession) errors.push(`http ${response.status()}: ${response.url()}`)
    }
  })

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.screenshot({ path: path.join(output, `${name}-00-home.png`), fullPage: true })
  for (const [index, route] of ['pricing', 'help'].entries()) {
    await page.goto(`${baseUrl}/${route}`, { waitUntil: 'networkidle' })
    await page.screenshot({ path: path.join(output, `${name}-00${index + 1}-${route}.png`), fullPage: true })
  }
  await page.goto(`${baseUrl}/auth/login`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: path.join(output, `${name}-01-login.png`), fullPage: true })
  const { SignJWT } = await import('jose')
  const token = await new SignJWT(
    { sub: userId, email: userEmail, name: 'QA Admin', role: 'admin', purpose: 'session' }
  )
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(jwtSecret))
  await context.addCookies([{ name: 'token', value: token, url: baseUrl, httpOnly: true, sameSite: 'Lax' }])
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' })
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: path.join(output, `${name}-02-dashboard.png`), fullPage: true })
  const routes = [
    'vehicles', 'deliveries', 'maintenance', 'clients', 'sop', 'vending-machines',
    'team', 'reports', 'analytics', 'billing', 'notifications',
    'settings/security', 'settings/integrations',
  ]
  for (const [index, route] of routes.entries()) {
    await page.goto(`${baseUrl}/${route}`, { waitUntil: 'networkidle' })
    await page.screenshot({
      path: path.join(output, `${name}-${String(index + 3).padStart(2, '0')}-${route.replaceAll('/', '-')}.png`),
      fullPage: true,
    })
  }

  const body = await page.locator('body').innerText()
  if (/application error|undefined is not|internal server error/i.test(body)) {
    errors.push(`rendered error: ${body.slice(0, 300)}`)
  }
  await context.close()
  return errors
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const results = {
    mobile: await exercise(browser, 'mobile-375', { width: 375, height: 812 }),
    desktop: await exercise(browser, 'desktop-1440', { width: 1440, height: 1000 }),
  }
  await browser.close()
  console.log(JSON.stringify(results, null, 2))
  if (Object.values(results).some(errors => errors.length)) process.exitCode = 1
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
