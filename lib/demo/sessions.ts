import type { NextApiRequest, NextApiResponse } from 'next'
import { createHash } from 'crypto'
import { serialize } from 'cookie'
import { prisma } from '../prisma'
import { getUserFromRequest, signToken } from '../auth'
import { establishSessionCookies, secureCookiesEnabled, teamCookie } from '../authCookies'
import { getClientIP } from '../rateLimit'
import { deleteOwnerWorkspaceData } from '../workspaceRetention'
import { seedDemoWorkspace } from './fixtures'
import { assertDemoEnvironment, DEMO_DURATION_SECONDS, type DemoRole } from './policy'

export async function cleanupDemoSessions(now = new Date()) {
  assertDemoEnvironment()
  const expired = await prisma.demoSession.findMany({
    where: { expiresAt: { lt: now } },
    take: 5,
    orderBy: { expiresAt: 'asc' },
  })
  for (const session of expired)
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(91824090)`
        const current = await tx.demoSession.findUnique({ where: { id: session.id } })
        if (!current || current.expiresAt >= now) return
        await deleteOwnerWorkspaceData(tx, current.ownerId, [current.teamId])
        await tx.user.deleteMany({ where: { id: { in: current.userIds } } })
        await tx.demoSession.delete({ where: { id: current.id } })
      },
      { timeout: 20_000 }
    )
}

export async function createDemoSession(req: NextApiRequest) {
  assertDemoEnvironment()
  await cleanupDemoSessions()
  const now = new Date(),
    hour = new Date(now)
  hour.setUTCMinutes(0, 0, 0)
  const ipKey = createHash('sha256').update(getClientIP(req)).digest('hex')
  return prisma.$transaction(
    async (tx) => {
      // Serialize provisioning across workers so global capacity cannot be raced.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(91824091)`
      const quota = await tx.apiRateLimit.upsert({
        where: { keyId_bucketStart: { keyId: `demo:${ipKey}`, bucketStart: hour } },
        create: { keyId: `demo:${ipKey}`, bucketStart: hour, count: 1 },
        update: { count: { increment: 1 } },
      })
      const globalQuota = await tx.apiRateLimit.upsert({
        where: { keyId_bucketStart: { keyId: 'demo-global', bucketStart: hour } },
        create: { keyId: 'demo-global', bucketStart: hour, count: 1 },
        update: { count: { increment: 1 } },
      })
      const [active, hourly] = await Promise.all([
        tx.demoSession.count({ where: { expiresAt: { gt: now } } }),
        tx.demoSession.count({ where: { createdAt: { gte: hour } } }),
      ])
      if (quota.count > 6 || globalQuota.count > 100 || active >= 100 || hourly >= 100) throw new Error('DEMO_CAPACITY')
      return seedDemoWorkspace(tx, now)
    },
    { timeout: 30_000 }
  )
}

export async function currentDemoSession(req: NextApiRequest) {
  assertDemoEnvironment()
  const auth = await getUserFromRequest(req)
  if (!auth?.demoSessionId) return null
  return prisma.demoSession.findUnique({ where: { id: auth.demoSessionId } })
}

export async function enterDemo(
  res: NextApiResponse,
  demo: NonNullable<Awaited<ReturnType<typeof currentDemoSession>>>,
  role: DemoRole = 'OWNER'
) {
  const user = await prisma.user.findFirst({ where: { id: { in: demo.userIds }, role } })
  if (!user || demo.expiresAt <= new Date()) throw new Error('DEMO_EXPIRED')
  const remaining = Math.min(DEMO_DURATION_SECONDS, Math.floor((demo.expiresAt.getTime() - Date.now()) / 1000))
  const token = await signToken(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tv: user.tokenVersion,
      demoSessionId: demo.id,
    },
    remaining
  )
  const cookies = establishSessionCookies(token)
  cookies[0] = serialize('token', token, {
    httpOnly: true,
    secure: secureCookiesEnabled(),
    sameSite: 'lax',
    path: '/',
    maxAge: remaining,
  })
  res.setHeader('Set-Cookie', [...cookies, teamCookie(demo.teamId)])
}

export function demoError(res: NextApiResponse, error: unknown) {
  if (error instanceof Error && error.message === 'DEMO_CAPACITY') {
    res.setHeader('Retry-After', '3600')
    return res
      .status(429)
      .json({ error: 'The demo is busy. Please try again later; each visitor gets a private sample workspace.' })
  }
  console.error('Demo request failed:', error instanceof Error ? error.message : 'unknown')
  return res.status(503).json({ error: 'The demo could not be opened. Please try again.' })
}
