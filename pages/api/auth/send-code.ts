import { randomUUID } from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { generateNumericCode, hashToken } from '../../../lib/tokens'
import { sendLoginCodeEmail } from '../../../lib/email'
import { rateLimitMiddleware, getClientIP } from '../../../lib/rateLimit'
import { assertSameOrigin } from '../../../lib/apiAuth'
import {
  awaitEmailDeliveryWithinTimeout,
  EMAIL_DELIVERY_TIMEOUT_MS,
  ensureMinimumResponseDuration,
  LOGIN_RESPONSE_TARGET_MS,
} from '../../../lib/authResponseTiming'

const GENERIC_MESSAGE = 'If an account exists, a login code has been sent.'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  res.setHeader('Cache-Control', 'private, no-store')
  if (!assertSameOrigin(req, res)) return

  const startedAt = Date.now()
  const genericResponse = async () => {
    await ensureMinimumResponseDuration(startedAt, { minimumMs: LOGIN_RESPONSE_TARGET_MS })
    return res.json({ message: GENERIC_MESSAGE })
  }

  const ip = getClientIP(req)
  const ipAllowed = await rateLimitMiddleware(req, res, 'login', ip)
  if (!ipAllowed) return

  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email is required' })
  const normalizedEmail = email.toLowerCase().trim()

  const emailAllowed = await rateLimitMiddleware(req, res, 'loginEmail', normalizedEmail)
  if (!emailAllowed) return

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (!user || (user.lockedUntil && new Date(user.lockedUntil) > new Date())) {
    return genericResponse()
  }

  const code = generateNumericCode(6)
  const expires = new Date(Date.now() + 10 * 60 * 1000)
  const hashedToken = hashToken(`${normalizedEmail}:${code}`)

  await prisma.verificationToken.deleteMany({
    where: { identifier: `login:${normalizedEmail}` },
  })
  await prisma.verificationToken.create({
    data: { identifier: `login:${normalizedEmail}`, token: hashedToken, expires },
  })

  const correlationId = randomUUID()
  try {
    const outcome = await awaitEmailDeliveryWithinTimeout(
      sendLoginCodeEmail(normalizedEmail, user.name || '', code, { correlationId }),
      { timeoutMs: EMAIL_DELIVERY_TIMEOUT_MS }
    )
    const errorCode = outcome.status === 'timeout'
      ? 'delivery_timeout'
      : outcome.status === 'failed'
        ? 'delivery_exception'
        : outcome.value.success
          ? undefined
          : outcome.value.errorCode || 'delivery_exception'
    if (errorCode) {
      console.error({
        event: 'auth.login_code.delivery_failed',
        correlationId,
        userId: user.id,
        provider: 'mailgun',
        errorCode,
      })
    }
  } catch {
    console.error({
      event: 'auth.login_code.delivery_failed',
      correlationId,
      userId: user.id,
      provider: 'mailgun',
      errorCode: 'delivery_exception',
    })
  }

  return genericResponse()
}
