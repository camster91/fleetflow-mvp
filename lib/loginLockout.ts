// Shared account-lockout policy for login codes and 2FA challenges.
import type { PrismaClient } from '@prisma/client'

export const LOGIN_MAX_FAILED_ATTEMPTS = 5
export const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000

interface LockoutState {
  failedLoginAttempts: number
  lockedUntil: Date | string | null
}

type LockoutDb = { user: Pick<PrismaClient['user'], 'updateMany'> }

export function isAccountLocked(user: LockoutState, now: Date = new Date()): boolean {
  return !!user.lockedUntil && new Date(user.lockedUntil) > now
}

/** True when a lock was set and has since expired, so the counter must restart. */
export function hasExpiredLock(user: LockoutState, now: Date = new Date()): boolean {
  return !!user.lockedUntil && new Date(user.lockedUntil) <= now
}

/** Prisma filter matching users who are not currently locked out. */
export function notLockedWhere(now: Date = new Date()) {
  return { OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] }
}

/**
 * Restart the failure counter once a lock has lapsed. Guarded on the stored
 * lock having expired, so a fresh lock set by a concurrent request is never
 * cleared.
 */
export async function resetExpiredLock(db: LockoutDb, userId: string, now: Date = new Date()): Promise<void> {
  await db.user.updateMany({
    where: { id: userId, lockedUntil: { lte: now } },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  })
}

/**
 * Record one failed login/2FA attempt without trusting a previously read
 * snapshot: the counter is incremented in the database, and the lock is set by
 * a conditional update once the stored count reaches the limit. Locking also
 * bumps tokenVersion so every session issued before the lock is revoked. An
 * existing active lock is never cleared or extended.
 */
export async function recordFailedAttempt(
  db: LockoutDb,
  userId: string,
  now: Date = new Date()
): Promise<{ locked: boolean }> {
  await resetExpiredLock(db, userId, now)
  await db.user.updateMany({
    where: { id: userId },
    data: { failedLoginAttempts: { increment: 1 } },
  })
  const locked = await db.user.updateMany({
    where: { id: userId, lockedUntil: null, failedLoginAttempts: { gte: LOGIN_MAX_FAILED_ATTEMPTS } },
    data: {
      lockedUntil: new Date(now.getTime() + LOGIN_LOCK_DURATION_MS),
      tokenVersion: { increment: 1 },
    },
  })
  return { locked: locked.count === 1 }
}
