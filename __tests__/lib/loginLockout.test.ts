import { LOGIN_MAX_FAILED_ATTEMPTS, recordFailedAttempt } from '@/lib/loginLockout'

type Row = { id: string; failedLoginAttempts: number; lockedUntil: Date | null; tokenVersion: number }

/** Minimal in-memory stand-in for prisma.user.updateMany with the filters the helper uses. */
function fakeDb(row: Row) {
  const matches = (where: any) => {
    if (where.id !== row.id) return false
    if ('lockedUntil' in where) {
      const f = where.lockedUntil
      if (f === null) {
        if (row.lockedUntil !== null) return false
      } else if (f.lte) {
        if (!row.lockedUntil || row.lockedUntil > f.lte) return false
      }
    }
    if (where.failedLoginAttempts?.gte !== undefined && row.failedLoginAttempts < where.failedLoginAttempts.gte)
      return false
    return true
  }
  const apply = (data: any) => {
    for (const [key, value] of Object.entries(data)) {
      const v = value as any
      ;(row as any)[key] = v && typeof v === 'object' && 'increment' in v ? (row as any)[key] + v.increment : v
    }
  }
  return {
    row,
    user: {
      updateMany: jest.fn(async ({ where, data }: any) => {
        // Yield so concurrent callers interleave like separate statements.
        await Promise.resolve()
        if (!matches(where)) return { count: 0 }
        apply(data)
        return { count: 1 }
      }),
    },
  }
}

describe('recordFailedAttempt', () => {
  const now = new Date('2026-09-25T12:00:00Z')

  it('increments the stored counter rather than writing a snapshot value', async () => {
    const db = fakeDb({ id: 'u1', failedLoginAttempts: 2, lockedUntil: null, tokenVersion: 0 })
    const result = await recordFailedAttempt(db as never, 'u1', now)
    expect(result.locked).toBe(false)
    expect(db.row).toEqual({ id: 'u1', failedLoginAttempts: 3, lockedUntil: null, tokenVersion: 0 })
  })

  it('counts every concurrent failure and locks exactly once, revoking sessions', async () => {
    const db = fakeDb({ id: 'u1', failedLoginAttempts: 0, lockedUntil: null, tokenVersion: 3 })
    const results = await Promise.all(
      Array.from({ length: LOGIN_MAX_FAILED_ATTEMPTS + 2 }, () => recordFailedAttempt(db as never, 'u1', now))
    )
    expect(db.row.failedLoginAttempts).toBe(LOGIN_MAX_FAILED_ATTEMPTS + 2)
    expect(db.row.lockedUntil).toEqual(new Date(now.getTime() + 15 * 60 * 1000))
    expect(results.filter((r) => r.locked)).toHaveLength(1)
    expect(db.row.tokenVersion).toBe(4)
  })

  it('never clears or extends an active lock', async () => {
    const lockedUntil = new Date(now.getTime() + 60_000)
    const db = fakeDb({ id: 'u1', failedLoginAttempts: 5, lockedUntil, tokenVersion: 1 })
    await recordFailedAttempt(db as never, 'u1', now)
    expect(db.row.lockedUntil).toBe(lockedUntil)
    expect(db.row.tokenVersion).toBe(1)
  })

  it('restarts the count after an expired lock so one failure does not re-lock', async () => {
    const db = fakeDb({
      id: 'u1',
      failedLoginAttempts: 5,
      lockedUntil: new Date(now.getTime() - 1000),
      tokenVersion: 1,
    })
    const result = await recordFailedAttempt(db as never, 'u1', now)
    expect(result.locked).toBe(false)
    expect(db.row).toEqual({ id: 'u1', failedLoginAttempts: 1, lockedUntil: null, tokenVersion: 1 })
  })
})
