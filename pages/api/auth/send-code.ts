import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { generateNumericCode, hashToken } from '../../../lib/tokens'
import { sendLoginCodeEmail } from '../../../lib/email'
import { rateLimitMiddleware, getClientIP } from '../../../lib/rateLimit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const ip = getClientIP(req)
  const ipAllowed = await rateLimitMiddleware(req, res, 'login', ip)
  if (!ipAllowed) return

  const { email } = req.body
  if (!email) {
    return res.status(400).json({ error: 'Email is required' })
  }

  const normalizedEmail = email.toLowerCase().trim()

  const emailAllowed = await rateLimitMiddleware(req, res, 'loginEmail', normalizedEmail)
  if (!emailAllowed) return

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (!user) {
    return res.json({ message: 'If an account exists, a login code has been sent.' })
  }

  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    return res.json({ message: 'If an account exists, a login code has been sent.' })
  }

  const code = generateNumericCode(6)
  const expires = new Date(Date.now() + 10 * 60 * 1000)
  // Store only a hash of email+code — never the plaintext code
  const hashedToken = hashToken(`${normalizedEmail}:${code}`)

  await prisma.verificationToken.deleteMany({
    where: { identifier: `login:${normalizedEmail}` },
  })

  await prisma.verificationToken.create({
    data: {
      identifier: `login:${normalizedEmail}`,
      token: hashedToken,
      expires,
    },
  })

  try {
    await sendLoginCodeEmail(normalizedEmail, user.name || '', code)
  } catch (err) {
    console.error('Failed to send login code email:', err)
  }

  return res.json({ message: 'If an account exists, a login code has been sent.' })
}
