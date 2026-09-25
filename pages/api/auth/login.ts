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

  // Per-email rate limiting: 5 attempts per 15 minutes
  const emailAllowed = await rateLimitMiddleware(req, res, 'loginEmail', normalizedEmail)
  if (!emailAllowed) return

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or code' })
  }

  // Check account lockout
  if (isAccountLocked(user)) {
    return res.status(423).json({ error: 'Account temporarily locked. Try again later.' })
  }

  // Look up hashed login code (email:code)
  const tokenRecord = await prisma.verificationToken.findFirst({
    where: {
      identifier: `login:${normalizedEmail}`,
      token: hashToken(`${normalizedEmail}:${String(code).trim()}`),
    },
  })

  if (!tokenRecord || new Date(tokenRecord.expires) < new Date()) {
    // Invalid or expired code: count the failure atomically in the database
    // (never from the stale snapshot above) and discard an expired code.
    await recordFailedAttempt(prisma, user.id)
    if (tokenRecord) {
      await prisma.verificationToken.deleteMany({ where: { identifier: `login:${normalizedEmail}` } })
    }
    return res.status(401).json({ error: 'Invalid or expired code' })
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
      // concurrently after the snapshot above must win.
      const signedIn = await tx.user.updateMany({
        where: { id: user.id, ...notLockedWhere() },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
          emailVerified: user.emailVerified ?? new Date(),
        },
      })
      if (signedIn.count !== 1) throw new AccountLockedError()
    })
  } catch (error) {
    if (error instanceof LoginCodeAlreadyConsumedError) {
      return res.status(401).json({ error: 'Invalid or expired code' })
    }
    if (error instanceof AccountLockedError) {
      return res.status(423).json({ error: 'Account temporarily locked. Try again later.' })
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
