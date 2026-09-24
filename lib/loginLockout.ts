// Shared account-lockout policy for login codes and 2FA challenges.

export const LOGIN_MAX_FAILED_ATTEMPTS = 5
export const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000

interface LockoutState {
  failedLoginAttempts: number
  lockedUntil: Date | string | null
}

export function isAccountLocked(user: LockoutState, now: Date = new Date()): boolean {
  return !!user.lockedUntil && new Date(user.lockedUntil) > now
}

/** True when a lock was set and has since expired, so the counter must restart. */
export function hasExpiredLock(user: LockoutState, now: Date = new Date()): boolean {
  return !!user.lockedUntil && new Date(user.lockedUntil) <= now
}

/**
 * Counter/lock values to persist after one more failed attempt. An expired
 * lock restarts the count so a single failure after the lock lapses does not
 * immediately re-lock the account.
 */
export function nextFailedAttemptState(
  user: LockoutState,
  now: Date = new Date()
): { failedLoginAttempts: number; lockedUntil: Date | null } {
  const previous = hasExpiredLock(user, now) ? 0 : user.failedLoginAttempts
  const failedLoginAttempts = previous + 1
  return {
    failedLoginAttempts,
    lockedUntil:
      failedLoginAttempts >= LOGIN_MAX_FAILED_ATTEMPTS
        ? new Date(now.getTime() + LOGIN_LOCK_DURATION_MS)
        : null,
  }
}
