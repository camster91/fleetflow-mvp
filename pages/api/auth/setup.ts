import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { signToken } from '../../../lib/auth'
import { rateLimitMiddleware, getClientIP } from '../../../lib/rateLimit'
import { assertSameOrigin } from '../../../lib/apiAuth'
import { establishSessionCookies } from '../../../lib/authCookies'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store')

  if (req.method === 'GET') {
    const count = await prisma.user.count()
    return res.status(200).json({ needed: count === 0 })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!assertSameOrigin(req, res)) return

  const ip = getClientIP(req)
  const allowed = await rateLimitMiddleware(req, res, 'login', ip)
  if (!allowed) return

  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : ''
  const name = typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : 'FleetVera Admin'
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Email is required' })
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const count = await tx.user.count()
      if (count !== 0) {
        const error = new Error('setup-forbidden')
        throw error
      }
      return tx.user.create({
        data: { email, name, role: 'admin', emailVerified: new Date(), onboardingCompleted: true },
      })
    })

    const token = await signToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tv: user.tokenVersion ?? 0,
    })
    res.setHeader('Set-Cookie', establishSessionCookies(token))
    return res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'setup-forbidden') {
      return res.status(403).json({ error: 'Setup is no longer available' })
    }
    throw error
  }
}
