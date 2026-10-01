import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { signToken } from '../../../lib/auth'
import { rateLimitMiddleware, getClientIP } from '../../../lib/rateLimit'
import { hashToken } from '../../../lib/tokens'
import { assertSameOrigin } from '../../../lib/apiAuth'
import { beginTwoFactorCookies, establishSessionCookies } from '../../../lib/authCookies'
import { isAccountLocked, notLockedWhere, recordFailedAttempt } from '../../../lib/loginLockout'

class LoginCodeAlreadyConsumedError extends Error {}
class AccountLockedError extends Error {}

// One response for an unknown email, a wrong or expired code and a locked account, so the
// endpoint never reveals whether an account exists or is locked.
const INVALID_LOGIN = {
  error: 'That code did not work. Request a new code; after several wrong codes, sign-in pauses for 15 minutes.',
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  res.setHeader('Cache-Control', 'private, no-store')
  if (!assertSameOrigin(req, res)) return

  // IP-based rate limiting
  const ip = getClientIP(req)
  const ipAllowed = await rateLimitMiddleware(req, res, 'login', ip)
  if (!ipAllowed) return

  const { email, code } = req.body
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' })
  }

  const normalizedEmail = email.toLowerCase().trim()

  // Per-email rate limiting: 5 attempts per 15 minutes, counted separately from code requests so
  // requesting codes for someone's address cannot use up their own sign-in attempts.
  const emailAllowed = await rateLimitMiddleware(req, res, 'loginEmail', `verify:${normalizedEmail}`)
  if (!emailAllowed) return

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (!user || isAccountLocked(user)) {
    return res.status(401).json(INVALID_LOGIN)
  }

  // Look up hashed login code (email:code)
  const tokenRecord = await prisma.verificationToken.findFirst({
    where: {
      identifier: `login:${normalizedEmail}`,
      token: hashToken(`${normalizedEmail}:${String(code).trim()}`),
    },
  })

  if (!tokenRecord || new Date(tokenRecord.expires) < new Date()) {
    // A wrong guess only counts toward the lockout while a code is outstanding for this address:
    // with nothing to guess, junk codes from a stranger must not lock the account. Counted
    // atomically in the database (never from the stale snapshot above); an expired code is discarded.
    const outstanding = await prisma.verificationToken.count({
      where: { identifier: `login:${normalizedEmail}`, expires: { gte: new Date() } },
    })
    if (outstanding > 0) await recordFailedAttempt(prisma, user.id)
    if (tokenRecord) {
      await prisma.verificationToken.deleteMany({ where: { identifier: `login:${normalizedEmail}` } })
    }
    return res.status(401).json(INVALID_LOGIN)
  }

  // Atomically consume this exact unexpired code before issuing a session.
  // A concurrent request that read the same token must observe a zero delete
  // count and fail closed instead of receiving a second session.
  try {
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.verificationToken.deleteMany({
        where: {
          identifier: `login:${normalizedEmail}`,
          token: tokenRecord.token,
          expires: { gte: new Date() },
        },
      })
      if (consumed.count !== 1) throw new LoginCodeAlreadyConsumedError()

      // Only clear the counter while the account is still unlocked; a lock set
      // concurrently after the snapshot above must win. With 2FA, sign-in completes (and the
      // counter resets) only in /api/auth/2fa/validate, so a fresh email code cannot reset the
      // count of wrong 2FA codes.
      const twoFactor = Boolean(user.twoFactorEnabled && user.twoFactorSecret)
      const signedIn = await tx.user.updateMany({
        where: { id: user.id, ...notLockedWhere() },
        data: {
          ...(twoFactor ? {} : { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() }),
          emailVerified: user.emailVerified ?? new Date(),
        },
      })
      if (signedIn.count !== 1) throw new AccountLockedError()
    })
  } catch (error) {
    if (error instanceof LoginCodeAlreadyConsumedError || error instanceof AccountLockedError) {
      return res.status(401).json(INVALID_LOGIN)
    }
    throw error
  }

  // Check if 2FA is enabled — require separate validation step
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    const challenge = await signToken(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        purpose: 'two-factor',
        tv: user.tokenVersion ?? 0,
      },
      '5m'
    )
    res.setHeader('Set-Cookie', beginTwoFactorCookies(challenge))
    return res.json({
      requiresTwoFactor: true,
    })
  }

  const token = await signToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tv: user.tokenVersion ?? 0,
  })

  res.setHeader('Set-Cookie', establishSessionCookies(token))

  return res.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  })
}
