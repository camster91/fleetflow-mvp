import { consumePublicApiQuota, minuteBucket } from '../../lib/apiRateLimit'

describe('durable public API quota', () => {
  it('uses an atomic composite-bucket upsert and permits exactly 100 requests', async () => {
    let count = 0
    const client = {
      apiRateLimit: {
        upsert: jest.fn(async ({ update }: any) => {
          expect(update).toEqual({ count: { increment: 1 } })
          count += 1
          return { count }
        }),
        deleteMany: jest.fn(async () => ({ count: 0 })),
      },
    }
    const now = new Date('2026-08-08T12:34:45.500Z')
    const results = await Promise.all(
      Array.from({ length: 101 }, () => consumePublicApiQuota(client as any, 'key-1', now))
    )
    expect(results.filter((result) => result.allowed)).toHaveLength(100)
    expect(results[100]).toMatchObject({ allowed: false, count: 101, remaining: 0, retryAfter: 15 })
    expect(client.apiRateLimit.upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { keyId_bucketStart: { keyId: 'key-1', bucketStart: new Date('2026-08-08T12:34:00.000Z') } },
      create: { keyId: 'key-1', bucketStart: new Date('2026-08-08T12:34:00.000Z'), count: 1 },
    }))
  })

  it('normalizes all timestamps in a minute to the same UTC bucket', () => {
    expect(minuteBucket(new Date('2026-08-08T23:59:59.999Z'))).toEqual(new Date('2026-08-08T23:59:00.000Z'))
  })
})
