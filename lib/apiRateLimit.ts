import type { PrismaClient } from '@prisma/client'

export const PUBLIC_API_REQUESTS_PER_MINUTE = 100

export function minuteBucket(now = new Date()): Date {
  const bucket = new Date(now)
  bucket.setUTCSeconds(0, 0)
  return bucket
}

/** Atomically consume one globally durable request from a per-key minute bucket. */
export async function consumePublicApiQuota(
  client: Pick<PrismaClient, 'apiRateLimit'>,
  keyId: string,
  now = new Date()
) {
  const bucketStart = minuteBucket(now)
  const row = await client.apiRateLimit.upsert({
    where: { keyId_bucketStart: { keyId, bucketStart } },
    create: { keyId, bucketStart, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  })
  if (row.count === 1) {
    const cutoff = new Date(bucketStart.getTime() - 24 * 60 * 60 * 1000)
    void client.apiRateLimit
      .deleteMany({ where: { bucketStart: { lt: cutoff } } })
      .catch(() => console.error('Public API rate-limit cleanup failed'))
  }
  return {
    allowed: row.count <= PUBLIC_API_REQUESTS_PER_MINUTE,
    count: row.count,
    remaining: Math.max(0, PUBLIC_API_REQUESTS_PER_MINUTE - row.count),
    retryAfter: Math.max(1, Math.ceil((bucketStart.getTime() + 60_000 - now.getTime()) / 1000)),
  }
}
