import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { signToken } from '../../../lib/auth'
import { serialize } from 'cookie'
import { rateLimitMiddleware, getClientIP } from '../../../lib/rateLimit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

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
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    return res.status(423).json({ error: 'Account temporarily locked. Try again later.' })
  }

  // Look up the verification token — token is stored as "code:randomSuffix"
  const tokenRecord = await prisma.verificationToken.findFirst({
    where: {
      identifier: `login:${normalizedEmail}`,
      token: { startsWith: `${code.trim()}:` },
    },
  })

  if (!tokenRecord || new Date(tokenRecord.expires) < new Date()) {
    // Invalid or expired code — update attempts + clean up token atomically
    const attempts = user.failedLoginAttempts + 1
    const lockout = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: attempts, lockedUntil: lockout },
      }),
      ...(tokenRecord
        ? [prisma.verificationToken.deleteMany({ where: { identifier: `login:${normalizedEmail}` } })]
        : []),
    ])
    return res.status(401).json({ error: 'Invalid or expired code' })
  }

  // Code is valid — delete token and reset user atomically
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({
      where: { identifier: `login:${normalizedEmail}` },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    }),
  ])

  const token = signToken({ sub: user.id, email: user.email, name: user.name, role: user.role })

  res.setHeader('Set-Cookie', serialize('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  }))

  return res.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  })
}
