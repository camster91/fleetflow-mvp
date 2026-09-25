import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { SignJWT } from 'jose'

test.describe('intelligence brief with disposable PostgreSQL', () => {
  test.skip(process.env.PLAYWRIGHT_INTEGRATED_DB !== '1', 'Requires the disposable PostgreSQL harness')
  const prisma = new PrismaClient()
  const now = new Date()

  test.beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        { id: 'qa-owner-a', email: 'qa-owner-a@fleetvera.test', name: 'QA Owner A', onboardingCompleted: true },
        { id: 'qa-owner-b', email: 'qa-owner-b@fleetvera.test', name: 'QA Owner B', onboardingCompleted: true },
        {
          id: 'qa-viewer',
          email: 'qa-viewer@fleetvera.test',
          name: 'QA Viewer',
          role: 'viewer',
          onboardingCompleted: true,
        },
      ],
    })
    await prisma.team.createMany({
      data: [
        { id: 'qa-team-a', name: 'QA A', ownerId: 'qa-owner-a' },
        { id: 'qa-team-b', name: 'QA B', ownerId: 'qa-owner-b' },
      ],
    })
    await prisma.teamMember.create({
      data: {
        id: 'qa-viewer-membership',
        teamId: 'qa-team-a',
        userId: 'qa-viewer',
        role: 'VIEWER',
        status: 'ACCEPTED',
        joinedAt: now,
      },
    })
    await prisma.delivery.createMany({
      data: Array.from({ length: 30 }, (_, index) => ({
        id: `qa-delivery-${index}`,
        customer: `Customer ${index}`,
        address: `${index} Test Road`,
        status: 'pending',
        ownerId: 'qa-owner-a',
        teamId: 'qa-team-a',
        scheduledTime: new Date(now.getTime() - 60 * 60 * 1000),
      })),
    })
    await prisma.intelligenceFinding.create({
      data: {
        id: 'qa-foreign-finding',
        ownerId: 'qa-owner-b',
        teamId: 'qa-team-b',
        type: 'vehicle-stale',
        severity: 'high',
        confidence: 1,
        score: 999,
        ruleVersion: 'qa',
        title: 'FOREIGN TENANT SECRET',
        explanation: 'Must never cross tenant scope.',
        evidence: '{"items":[],"total":0,"truncated":false}',
        status: 'OPEN',
        generatedAt: now,
      },
    })
  })

  test.afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: ['qa-owner-a', 'qa-owner-b', 'qa-viewer'] } } })
    await prisma.$disconnect()
  })

  test('persists, isolates, audits, paginates, and redacts without route mocks', async ({ page, baseURL }) => {
    const token = await new SignJWT({
      sub: 'qa-owner-a',
      email: 'qa-owner-a@fleetvera.test',
      name: 'QA Owner A',
      role: 'fleet_manager',
      purpose: 'session',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET!))
    const origin = new URL(baseURL!)
    await page
      .context()
      .addCookies([
        { name: 'token', value: token, domain: origin.hostname, path: '/', httpOnly: true, sameSite: 'Lax' },
      ])

    await page.goto('/dashboard')
    await page.getByRole('button', { name: /^refresh$/i }).click()
    await expect(page.getByText('Fleet intelligence refreshed.')).toBeVisible()
    expect(await prisma.intelligenceRun.findUnique({ where: { id: 'team:qa-team-a' } })).toEqual(
      expect.objectContaining({
        sourceComplete: true,
        findingsComplete: true,
        reconciliationComplete: true,
        evidenceComplete: true,
      })
    )

    const briefResponse = await page.request.get('/api/intelligence/brief')
    expect(briefResponse.ok()).toBe(true)
    expect(await briefResponse.text()).not.toContain('FOREIGN TENANT SECRET')

    const firstCard = page.locator('[data-testid="finding-card"]').first()
    await firstCard.getByRole('button', { name: 'Why am I seeing this?' }).click()
    const recordLink = firstCard.getByRole('link', { name: /^open delivery record$/i }).first()
    await expect(recordLink).toHaveAttribute('href', /\/deliveries\?record=qa-delivery-/)
    await recordLink.click()
    await expect(page).toHaveURL(/\/deliveries\?record=qa-delivery-/)
    await page.goto('/dashboard')

    const openBefore = (await page.request
      .get('/api/intelligence/findings?status=OPEN&limit=10')
      .then((response) => response.json())) as { findings: Array<{ id: string }> }
    const feedbackId = openBefore.findings[1].id
    const mutationHeaders = { Origin: origin.origin }
    const helpful = await page.request.patch('/api/intelligence/findings', {
      headers: mutationHeaders,
      data: { id: feedbackId, action: 'HELPFUL' },
    })
    expect(helpful.ok()).toBe(true)
    expect((await helpful.json()).finding.feedback).toBe('HELPFUL')
    expect(await prisma.auditLog.count({ where: { teamId: 'qa-team-a', action: 'feedback_recorded' } })).toBe(1)
    const duplicate = await page.request.patch('/api/intelligence/findings', {
      headers: mutationHeaders,
      data: { id: feedbackId, action: 'HELPFUL' },
    })
    expect(await duplicate.json()).toEqual(expect.objectContaining({ noop: true }))
    expect(await prisma.auditLog.count({ where: { teamId: 'qa-team-a', action: 'feedback_recorded' } })).toBe(1)
    const switched = await page.request.patch('/api/intelligence/findings', {
      headers: mutationHeaders,
      data: { id: feedbackId, action: 'NOT_HELPFUL' },
    })
    expect((await switched.json()).finding.feedback).toBe('NOT_HELPFUL')
    expect(await prisma.auditLog.count({ where: { teamId: 'qa-team-a', action: 'feedback_recorded' } })).toBe(2)

    const csrfAuditCount = await prisma.auditLog.count({ where: { teamId: 'qa-team-a' } })
    const csrf = await page.request.patch('/api/intelligence/findings', {
      headers: { Origin: 'https://evil.example' },
      data: { id: feedbackId, action: 'DISMISS' },
    })
    expect(csrf.status()).toBe(403)
    expect(await prisma.auditLog.count({ where: { teamId: 'qa-team-a' } })).toBe(csrfAuditCount)
    expect((await prisma.intelligenceFinding.findUnique({ where: { id: feedbackId } }))?.status).toBe('OPEN')

    const resolveId = openBefore.findings[2].id
    expect(
      (
        await page.request.patch('/api/intelligence/findings', {
          headers: mutationHeaders,
          data: { id: resolveId, action: 'RESOLVE' },
        })
      ).ok()
    ).toBe(true)
    const resolved = (await page.request
      .get('/api/intelligence/findings?status=RESOLVED&limit=25')
      .then((response) => response.json())) as { findings: Array<{ id: string; effectiveStatus: string }> }
    expect(resolved.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: resolveId, effectiveStatus: 'RESOLVED' })])
    )

    await prisma.intelligenceFinding.create({
      data: {
        id: 'qa-expired',
        ownerId: 'qa-owner-a',
        teamId: 'qa-team-a',
        type: 'vehicle-stale',
        severity: 'low',
        confidence: 1,
        score: 1,
        ruleVersion: 'qa',
        title: 'Expired QA finding',
        explanation: 'Expired',
        evidence: '{"items":[],"total":0,"truncated":false}',
        status: 'OPEN',
        generatedAt: now,
        expiresAt: new Date(now.getTime() - 1000),
      },
    })
    const expired = (await page.request
      .get('/api/intelligence/findings?status=EXPIRED&limit=25')
      .then((response) => response.json())) as { findings: Array<{ id: string; effectiveStatus: string }> }
    expect(expired.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'qa-expired', effectiveStatus: 'EXPIRED' })])
    )

    const viewerToken = await new SignJWT({
      sub: 'qa-viewer',
      email: 'qa-viewer@fleetvera.test',
      role: 'viewer',
      purpose: 'session',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET!))
    const viewerContext = await page
      .context()
      .browser()!
      .newContext(baseURL ? { baseURL } : {})
    await viewerContext.addCookies([
      { name: 'token', value: viewerToken, domain: origin.hostname, path: '/', httpOnly: true, sameSite: 'Lax' },
      { name: 'fleetflow_team', value: 'qa-team-a', domain: origin.hostname, path: '/', sameSite: 'Lax' },
    ])
    const viewerPage = await viewerContext.newPage()
    const viewerRefresh = await viewerPage.request.post('/api/intelligence/findings', { headers: mutationHeaders })
    expect(viewerRefresh.status()).toBe(403)
    const viewerLifecycle = await viewerPage.request.patch('/api/intelligence/findings', {
      headers: mutationHeaders,
      data: { id: feedbackId, action: 'DISMISS' },
    })
    expect(viewerLifecycle.status()).toBe(403)
    await viewerContext.close()

    const anonymousContext = await page
      .context()
      .browser()!
      .newContext(baseURL ? { baseURL } : {})
    const anonymous = await anonymousContext.request.post('/api/intelligence/findings', { headers: mutationHeaders })
    expect(anonymous.status()).toBe(401)
    await anonymousContext.close()

    const topTitle = await page.locator('[data-testid="finding-card"] h3').first().textContent()
    await page
      .locator('[data-testid="finding-card"]')
      .first()
      .getByRole('button', { name: /^dismiss /i })
      .click()
    await expect.poll(() => prisma.auditLog.count({ where: { teamId: 'qa-team-a', action: 'dismissed' } })).toBe(1)
    expect(topTitle).toBeTruthy()

    await page.goto('/intelligence')
    await expect(page.getByRole('button', { name: 'Load more' })).toBeVisible()
    const firstPageCount = await page.locator('[data-testid="finding-card"]').count()
    expect(firstPageCount).toBe(25)
    await page.getByRole('button', { name: 'Load more' }).click()
    await expect.poll(() => page.locator('[data-testid="finding-card"]').count()).toBeGreaterThan(25)
    await page.getByLabel('Finding status').selectOption('DISMISSED')
    await expect(page.locator('[data-testid="finding-card"]').first()).toBeVisible()

    await prisma.intelligenceFinding.create({
      data: {
        id: 'qa-pii',
        ownerId: 'qa-owner-a',
        teamId: 'qa-team-a',
        type: 'data-quality-blocker',
        severity: 'high',
        confidence: 1,
        score: 1000,
        ruleVersion: 'legacy',
        title: 'Legacy evidence',
        explanation: 'Legacy',
        status: 'OPEN',
        generatedAt: now,
        evidence:
          '{"items":[{"entityType":"client","entityId":"c-1","field":"email","value":"private@example.test","timestamp":null}],"total":1,"truncated":false}',
      },
    })
    const findingsResponse = await page.request.get('/api/intelligence/findings?status=OPEN&limit=50')
    const findingsText = await findingsResponse.text()
    expect(findingsText).not.toContain('private@example.test')
    expect(findingsText).not.toContain('qa-owner-a')
  })
})
