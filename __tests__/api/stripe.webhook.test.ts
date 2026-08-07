import { createMocks } from 'node-mocks-http'
import type { NextApiRequest, NextApiResponse } from 'next'
import handler, {
  getInvoiceSubscriptionId,
  getSubscriptionPeriod,
} from '../../pages/api/stripe/webhook'
import { prisma } from '../../lib/prisma'

jest.mock('../../lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
  },
}))

jest.mock('../../lib/stripe', () => ({
  constructWebhookEvent: jest.fn(),
}))

import { constructWebhookEvent } from '../../lib/stripe'

describe('Stripe webhook compatibility', () => {
  test('reads the current period from subscription items', () => {
    expect(getSubscriptionPeriod({
      items: {
        data: [{ current_period_start: 100, current_period_end: 200 }],
      },
    })).toEqual({ start: 100, end: 200 })
  })

  test('reads the subscription ID from the invoice parent', () => {
    expect(getInvoiceSubscriptionId({
      parent: {
        type: 'subscription_details',
        subscription_details: { subscription: 'sub_123' },
      },
    })).toBe('sub_123')
  })

  test('returns 500 when event processing fails so Stripe can retry', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_123' } },
    })
    ;(prisma.subscription.findUnique as jest.Mock).mockRejectedValue(new Error('database unavailable'))

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      headers: { 'stripe-signature': 'valid-signature' },
    })
    Object.assign(req, {
      async *[Symbol.asyncIterator]() {
        yield Buffer.from('{}')
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(500)
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
