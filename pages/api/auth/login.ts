import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { verifyPassword, signToken } from '../../../lib/auth'
import { serialize } from 'cookie'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  })

  if (!user || !user.password) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  // Check account lockout
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    return res.status(423).json({ error: 'Account temporarily locked. Try again later.' })
  }

  const valid = await verifyPassword(password, user.password)
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1
    const lockout = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: attempts, lockedUntil: lockout },
    })
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  // Reset failed attempts, update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  })

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
