import type { NextApiResponse } from 'next'
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'

export type IntegrationRateAction = 'connect' | 'callback' | 'sync' | 'review'
export function integrationRatePolicy(action: IntegrationRateAction) {
  return action === 'connect'
    ? { limit: 10, windowMs: 300_000 }
    : action === 'callback'
      ? { limit: 20, windowMs: 300_000 }
      : action === 'sync'
        ? { limit: 30, windowMs: 3_600_000 }
        : { limit: 60, windowMs: 60_000 }
}
export function rateBucket(now: Date, windowMs: number) {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs)
}

export async function consumeIntegrationRateLimit(
  actorId: string,
  scopeKey: string,
  provider: string,
  action: IntegrationRateAction,
  now = new Date()
) {
  const policy = integrationRatePolicy(action)
  const bucketStart = rateBucket(now, policy.windowMs)
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    INSERT INTO "IntegrationRateLimit" ("actorId", "scopeKey", "provider", "action", "bucketStart", "count")
    VALUES (${actorId}, ${scopeKey}, ${provider}, ${action}, ${bucketStart}, 1)
    ON CONFLICT ("actorId", "scopeKey", "provider", "action", "bucketStart")
    DO UPDATE SET "count" = "IntegrationRateLimit"."count" + 1
    WHERE "IntegrationRateLimit"."count" < ${policy.limit}
    RETURNING "count"
  `)
  return {
    allowed: rows.length === 1,
    remaining: Math.max(0, policy.limit - (rows[0]?.count || policy.limit)),
    retryAfter: Math.max(1, Math.ceil((bucketStart.getTime() + policy.windowMs - now.getTime()) / 1000)),
  }
}

export async function enforceIntegrationRateLimit(
  actorId: string,
  scopeKey: string,
  provider: string,
  action: IntegrationRateAction,
  res: NextApiResponse
) {
  try {
    const result = await consumeIntegrationRateLimit(actorId, scopeKey, provider, action)
    res.setHeader('X-RateLimit-Remaining', String(result.remaining))
    if (result.allowed) return true
    res.setHeader('Retry-After', String(result.retryAfter))
    res.status(429).json({ error: 'Too many integration requests. Try again later.' })
    return false
  } catch {
    res.status(503).json({ error: 'Integration request quota could not be verified' })
    return false
  }
}
