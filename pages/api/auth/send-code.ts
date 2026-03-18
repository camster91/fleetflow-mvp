import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { generateNumericCode, generateSecureToken } from '../../../lib/tokens'
import { sendLoginCodeEmail } from '../../../lib/email'
import { rateLimitMiddleware, getClientIP } from '../../../lib/rateLimit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const ip = getClientIP(req)
  const allowed = await rateLimitMiddleware(req, res, 'login', ip)
  if (!allowed) return

  const { email } = req.body
  if (!email) {
    return res.status(400).json({ error: 'Email is required' })
  }

  const normalizedEmail = email.toLowerCase().trim()

  // Find user — only existing users can log in
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  // Always return success to prevent email enumeration
  if (!user) {
    return res.json({ message: 'If an account exists, a login code has been sent.' })
  }

  // Check account lockout
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    return res.json({ message: 'If an account exists, a login code has been sent.' })
  }

  // Generate a 6-digit code
  const code = generateNumericCode(6)
  const expires = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
  // Use a unique token (code + random suffix) since the token field has @unique
  const uniqueToken = `${code}:${generateSecureToken(8)}`

  // Store code in VerificationToken table
  // Delete any existing codes for this email first
  await prisma.verificationToken.deleteMany({
    where: { identifier: `login:${normalizedEmail}` },
  })

  await prisma.verificationToken.create({
    data: {
      identifier: `login:${normalizedEmail}`,
      token: uniqueToken,
      expires,
    },
  })

  // Send the code via email
  try {
    await sendLoginCodeEmail(normalizedEmail, user.name || '', code)
  } catch (err) {
    console.error('Failed to send login code email:', err)
  }

  return res.json({ message: 'If an account exists, a login code has been sent.' })
}
