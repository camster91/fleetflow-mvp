import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    verificationToken: { deleteMany: jest.fn(), create: jest.fn() },
  },
}))
jest.mock('@/lib/rateLimit', () => ({
  getClientIP: jest.fn(() => '127.0.0.1'),
  rateLimitMiddleware: jest.fn(async () => true),
}))
jest.mock('@/lib/apiAuth', () => ({ assertSameOrigin: jest.fn(() => true) }))
jest.mock('@/lib/tokens', () => ({
  generateNumericCode: jest.fn(() => '123456'),
  hashToken: jest.fn(() => 'hashed-login-token'),
}))
jest.mock('@/lib/email', () => ({
  sendLoginCodeEmail: jest.fn(),
}))
jest.mock('@/lib/authResponseTiming', () => ({
  ensureMinimumResponseDuration: jest.fn(async () => undefined),
  awaitEmailDeliveryWithinTimeout: jest.fn(async (delivery: Promise<unknown>) => ({
    status: 'delivered', value: await delivery,
  })),
  LOGIN_RESPONSE_TARGET_MS: 20,
  EMAIL_DELIVERY_TIMEOUT_MS: 10,
}))

import handler from '@/pages/api/auth/send-code'
import { prisma } from '@/lib/prisma'
import { sendLoginCodeEmail } from '@/lib/email'
import { assertSameOrigin } from '@/lib/apiAuth'
import {
  awaitEmailDeliveryWithinTimeout,
  ensureMinimumResponseDuration,
  LOGIN_RESPONSE_TARGET_MS,
} from '@/lib/authResponseTiming'

describe('POST /api/auth/send-code', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(assertSameOrigin as jest.Mock).mockReturnValue(true)
    ;(awaitEmailDeliveryWithinTimeout as jest.Mock).mockImplementation(
      async (delivery: Promise<unknown>) => {
        try { return { status: 'delivered', value: await delivery } }
        catch { return { status: 'failed' } }
      }
    )
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1', email: 'driver@example.com', name: 'Driver', lockedUntil: null,
    })
    ;(prisma.verificationToken.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })
    ;(prisma.verificationToken.create as jest.Mock).mockResolvedValue({})
  })

  it('rejects a cross-origin request before account lookup or delivery', async () => {
    ;(assertSameOrigin as jest.Mock).mockImplementation((_req, res) => {
      res.status(403).json({ error: 'Forbidden origin' })
      return false
    })
    const { req, res } = createMocks({
      method: 'POST',
      headers: { host: 'fleetvera.example', origin: 'https://evil.example' },
      body: { email: 'driver@example.com' },
    })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(403)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
    expect(sendLoginCodeEmail).not.toHaveBeenCalled()
  })

  it('keeps the generic response and records a correlated structured error when delivery fails', async () => {
    ;(sendLoginCodeEmail as jest.Mock).mockResolvedValue({
      success: false,
      errorCode: 'provider_unavailable',
    })
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const { req, res } = createMocks({
      method: 'POST',
      body: { email: ' Driver@Example.com ' },
    })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(200)
    expect(JSON.parse(res._getData())).toEqual({
      message: 'If an account exists, a login code has been sent.',
    })
    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
      event: 'auth.login_code.delivery_failed',
      correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      userId: 'user-1',
      provider: 'mailgun',
      errorCode: 'provider_unavailable',
    }))
    expect(sendLoginCodeEmail).toHaveBeenCalledWith(
      'driver@example.com', 'Driver', '123456',
      { correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/i) }
    )
    expect(ensureMinimumResponseDuration).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('returns through the bounded timeout path when provider delivery never settles', async () => {
    ;(sendLoginCodeEmail as jest.Mock).mockReturnValue(new Promise(() => undefined))
    ;(awaitEmailDeliveryWithinTimeout as jest.Mock).mockResolvedValueOnce({ status: 'timeout' })
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const { req, res } = createMocks({ method: 'POST', body: { email: 'driver@example.com' } })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(200)
    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
      errorCode: 'delivery_timeout', correlationId: expect.any(String),
    }))
    expect(ensureMinimumResponseDuration).toHaveBeenCalledWith(
      expect.any(Number), expect.objectContaining({ minimumMs: LOGIN_RESPONSE_TARGET_MS })
    )
    errorSpy.mockRestore()
  })

  it('uses identical response target semantics for unknown, locked, delivered and failed paths', async () => {
    const run = async (user: unknown, delivery?: unknown) => {
      jest.clearAllMocks()
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(user)
      ;(prisma.verificationToken.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })
      ;(prisma.verificationToken.create as jest.Mock).mockResolvedValue({})
      if (delivery) {
        ;(sendLoginCodeEmail as jest.Mock).mockResolvedValue(delivery)
        ;(awaitEmailDeliveryWithinTimeout as jest.Mock).mockResolvedValue({ status: 'delivered', value: delivery })
      }
      const { req, res } = createMocks({ method: 'POST', body: { email: 'driver@example.com' } })
      await handler(req as never, res as never)
      return (ensureMinimumResponseDuration as jest.Mock).mock.calls[0][1]
    }
    const active = { id: 'user-1', email: 'driver@example.com', name: 'Driver', lockedUntil: null }
    const options = [
      await run(null),
      await run({ ...active, lockedUntil: new Date(Date.now() + 60_000) }),
      await run(active, { success: true }),
      await run(active, { success: false, errorCode: 'provider_rejected' }),
    ]
    expect(options).toEqual(options.map(() => ({ minimumMs: LOGIN_RESPONSE_TARGET_MS })))
  })

  it('sanitizes thrown provider errors and preserves the generic response', async () => {
    ;(sendLoginCodeEmail as jest.Mock).mockRejectedValue(
      new Error('Mailgun rejected driver@example.com with code 123456 and key secret-key')
    )
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const { req, res } = createMocks({ method: 'POST', body: { email: 'driver@example.com' } })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(200)
    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
      event: 'auth.login_code.delivery_failed', errorCode: 'delivery_exception',
    }))
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('driver@example.com')
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('123456')
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('secret-key')
    errorSpy.mockRestore()
  })

  it.each([
    ['unknown account', null],
    ['locked account', { id: 'user-1', email: 'driver@example.com', name: 'Driver', lockedUntil: new Date(Date.now() + 60_000) }],
  ])('uses the generic timed response for %s', async (_label, user) => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(user)
    const { req, res } = createMocks({ method: 'POST', body: { email: 'driver@example.com' } })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(200)
    expect(ensureMinimumResponseDuration).toHaveBeenCalled()
    expect(sendLoginCodeEmail).not.toHaveBeenCalled()
  })

  it('uses the generic timed response after successful delivery without logging the token', async () => {
    ;(sendLoginCodeEmail as jest.Mock).mockResolvedValue({ success: true, messageId: 'provider-id' })
    const logSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const { req, res } = createMocks({ method: 'POST', body: { email: 'driver@example.com' } })
    await handler(req as never, res as never)
    expect(ensureMinimumResponseDuration).toHaveBeenCalled()
    expect(prisma.verificationToken.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ token: 'hashed-login-token' }),
    }))
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain('123456')
    logSpy.mockRestore()
  })
})
