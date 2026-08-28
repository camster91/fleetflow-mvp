import { createMocks } from 'node-mocks-http'
import type { NextApiRequest, NextApiResponse } from 'next'
import handler, {
  getInvoiceSubscriptionId,
  getSubscriptionPeriod,
  isDuplicateWebhookEvent,
  STRIPE_WEBHOOK_MAX_BYTES,
} from '../../pages/api/stripe/webhook'
import { prisma } from '../../lib/prisma'

jest.mock('../../lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    stripeWebhookEvent: { create: jest.fn(), findUnique: jest.fn() },
    subscription: {
      findUnique: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    invoice: { upsert: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}))

jest.mock('../../lib/stripe', () => ({
  constructWebhookEvent: jest.fn(),
  resolvePricePlan: jest.fn((priceId: string) => priceId === 'price_monthly' ? 'UNLIMITED' : null),
  retrieveSubscriptionSnapshot: jest.fn(),
  retrieveInvoiceSnapshot: jest.fn(),
}))

import { constructWebhookEvent } from '../../lib/stripe'

describe('Stripe webhook compatibility', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma))
    ;(prisma.stripeWebhookEvent.create as jest.Mock).mockResolvedValue({})
    ;(prisma.stripeWebhookEvent.findUnique as jest.Mock).mockResolvedValue(null)
    const { resolvePricePlan } = jest.requireMock('../../lib/stripe')
    resolvePricePlan.mockImplementation((priceId: string) => priceId === 'price_monthly' ? 'UNLIMITED' : null)
    const { retrieveSubscriptionSnapshot } = jest.requireMock('../../lib/stripe')
    retrieveSubscriptionSnapshot.mockResolvedValue({
      id: 'sub_123', status: 'ACTIVE', priceId: 'price_monthly', currentPeriodStart: 100,
      currentPeriodEnd: 200, cancelAtPeriodEnd: false,
    })
    const { retrieveInvoiceSnapshot } = jest.requireMock('../../lib/stripe')
    retrieveInvoiceSnapshot.mockResolvedValue({
      id: 'in_123', status: 'paid', amountPaid: 4900, amountDue: 0, currency: 'usd',
      invoicePdf: 'https://invoice.stripe.com/in_123.pdf', periodStart: 100, periodEnd: 200,
    })
  })
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

  test.each([
    { code: 'P2002', meta: { modelName: 'StripeWebhookEvent', target: ['id'] } },
    { code: 'P2002', meta: { modelName: 'StripeWebhookEvent', target: 'id' } },
    { code: 'P2002', meta: { target: ['id'] } },
    { code: 'P2002', meta: { target: 'id' } },
    { code: 'P2002', meta: { target: 'StripeWebhookEvent_pkey' } },
    { code: 'P2002', meta: { target: 'public.StripeWebhookEvent.id' } },
  ])('recognizes deployed webhook primary-key collision shape %#', error => {
    expect(isDuplicateWebhookEvent(error)).toBe(true)
  })

  test.each([
    { code: 'P2002', meta: { modelName: 'Invoice', target: ['id'] } },
    { code: 'P2002', meta: { target: 'Invoice_stripeInvoiceId_key' } },
    { code: 'P2002', meta: { modelName: 'Subscription', target: 'stripeSubscriptionId' } },
  ])('does not misclassify downstream collision shape %#', error => {
    expect(isDuplicateWebhookEvent(error)).toBe(false)
  })

  test('acknowledges a duplicate event without applying it twice', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({ id: 'evt_duplicate', type: 'customer.subscription.deleted', data: { object: { id: 'sub_123' } } })
    ;(prisma.stripeWebhookEvent.create as jest.Mock).mockRejectedValue(Object.assign(new Error('duplicate'), {
      code: 'P2002', meta: { modelName: 'StripeWebhookEvent', target: ['id'] },
    }))
    const { req, res } = webhookRequest()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData()).toEqual({ received: true, duplicate: true })
    expect(prisma.subscription.update).not.toHaveBeenCalled()
  })

  test('short-circuits an already processed event before provider reconciliation', async () => {
    const stripe = jest.requireMock('../../lib/stripe')
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({ id: 'evt_existing', created: 100, type: 'invoice.paid', data: { object: invoiceFixture('paid') } })
    ;(prisma.stripeWebhookEvent.findUnique as jest.Mock).mockResolvedValue({ id: 'evt_existing' })
    stripe.retrieveSubscriptionSnapshot.mockRejectedValue(new Error('must not run'))
    stripe.retrieveInvoiceSnapshot.mockRejectedValue(new Error('must not run'))
    const { req, res } = webhookRequest()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData()).toEqual({ received: true, duplicate: true })
    expect(stripe.retrieveSubscriptionSnapshot).not.toHaveBeenCalled()
    expect(stripe.retrieveInvoiceSnapshot).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  test('returns 500 for a downstream unique collision so Stripe retries', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({ id: 'evt_downstream', type: 'invoice.paid', data: { object: invoiceFixture('paid') } })
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({ id: 'local-sub', userId: 'owner-1', status: 'ACTIVE' })
    ;(prisma.invoice.upsert as jest.Mock).mockRejectedValue(Object.assign(new Error('invoice collision'), {
      code: 'P2002', meta: { modelName: 'Invoice', target: ['stripeInvoiceId'] },
    }))
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const { req, res } = webhookRequest()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(500)
    expect(res._getJSONData()).toEqual({ error: 'Webhook processing failed' })
    errorSpy.mockRestore()
  })

  test('rejects a webhook without a signature', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: 'POST' })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(400)
    expect(constructWebhookEvent).not.toHaveBeenCalled()
  })

  test('rejects an invalid signature without exposing provider errors', async () => {
    ;(constructWebhookEvent as jest.Mock).mockImplementation(() => { throw new Error('secret provider detail') })
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const { req, res } = webhookRequest()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(400)
    expect(res._getJSONData()).toEqual({ error: 'Webhook signature verification failed' })
    expect(errorSpy).toHaveBeenCalledWith('Stripe webhook signature verification failed')
    errorSpy.mockRestore()
  })

  test('passes the raw request bytes unchanged to signature validation', async () => {
    const raw = Buffer.from('{ "exact": "bytes" }\n')
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({ id: 'evt_raw', type: 'unknown.event', data: { object: {} } })
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: 'POST', headers: { 'stripe-signature': 'sig' } })
    Object.assign(req, { async *[Symbol.asyncIterator]() { yield raw.subarray(0, 8); yield raw.subarray(8) } })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(constructWebhookEvent).toHaveBeenCalledWith(raw, 'sig')
  })

  test('rejects an oversized declared body before signature validation', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      headers: {
        'stripe-signature': 'sig',
        'content-length': String(STRIPE_WEBHOOK_MAX_BYTES + 1),
      },
    })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(413)
    expect(constructWebhookEvent).not.toHaveBeenCalled()
  })

  test('rejects a streamed body that crosses the byte limit', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST', headers: { 'stripe-signature': 'sig' },
    })
    const chunk = Buffer.alloc(Math.ceil(STRIPE_WEBHOOK_MAX_BYTES / 2) + 1)
    Object.assign(req, { async *[Symbol.asyncIterator]() { yield chunk; yield chunk } })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(413)
    expect(constructWebhookEvent).not.toHaveBeenCalled()
  })

  test('returns 500 without committing a marker when invoice reconciliation fails', async () => {
    const stripe = jest.requireMock('../../lib/stripe')
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({ id: 'evt_invoice_lookup_fail', created: 100, type: 'invoice.paid', data: { object: invoiceFixture('paid') } })
    stripe.retrieveInvoiceSnapshot.mockRejectedValueOnce(new Error('provider detail'))
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const { req, res } = webhookRequest()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(500)
    expect(res._getJSONData()).toEqual({ error: 'Webhook processing failed' })
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.stripeWebhookEvent.create).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  test('rejects a subscription event with an unknown configured price', async () => {
    const { retrieveSubscriptionSnapshot } = jest.requireMock('../../lib/stripe')
    retrieveSubscriptionSnapshot.mockResolvedValueOnce({ id: 'sub_123', status: 'ACTIVE', priceId: 'price_wrong', currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false })
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({
      id: 'evt_mismatch', type: 'customer.subscription.updated',
      data: { object: { id: 'sub_123', status: 'active', cancel_at_period_end: false, items: { data: [{ price: { id: 'price_wrong' } }] } } },
    })
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({ id: 'local-sub', userId: 'owner-1', status: 'TRIAL' })
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const { req, res } = webhookRequest()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(500)
    expect(prisma.subscription.update).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  test('records a failed invoice and transitions the subscription to past due', async () => {
    const { retrieveSubscriptionSnapshot, retrieveInvoiceSnapshot } = jest.requireMock('../../lib/stripe')
    retrieveSubscriptionSnapshot.mockResolvedValueOnce({ id: 'sub_123', status: 'PAST_DUE', priceId: 'price_monthly', currentPeriodStart: 100, currentPeriodEnd: 200, cancelAtPeriodEnd: false })
    retrieveInvoiceSnapshot.mockResolvedValueOnce({ id: 'in_123', status: 'open', amountPaid: 0, amountDue: 4900, currency: 'usd', invoicePdf: null, periodStart: 100, periodEnd: 200 })
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({ id: 'evt_failed', type: 'invoice.payment_failed', data: { object: invoiceFixture('open') } })
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({ id: 'local-sub', userId: 'owner-1', status: 'ACTIVE' })
    const { req, res } = webhookRequest()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(prisma.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PAST_DUE' }) }))
    expect(prisma.invoice.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { stripeInvoiceId: 'in_123' } }))
    expect(prisma.invoice.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ status: 'failed' }), create: expect.objectContaining({ status: 'failed' }),
    }))
    expect(prisma.auditLog.create).toHaveBeenCalled()
  })

  test('keeps authoritative paid invoice truth when a delayed payment_failed event arrives', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({ id: 'evt_failed_but_paid', created: 300, type: 'invoice.payment_failed', data: { object: invoiceFixture('failed') } })
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({ id: 'local-sub', userId: 'owner-1', status: 'ACTIVE', stripeLastEventCreated: 200 })
    const { req, res } = webhookRequest()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(prisma.invoice.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ status: 'paid' }) }))
    expect(prisma.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) }))
  })

  test('records a paid invoice and restores the subscription to active', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({ id: 'evt_paid', type: 'invoice.paid', data: { object: invoiceFixture('paid') } })
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({ id: 'local-sub', userId: 'owner-1', status: 'PAST_DUE' })
    const { req, res } = webhookRequest()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(prisma.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) }))
    expect(prisma.invoice.upsert).toHaveBeenCalled()
  })

  test.each([
    ['invoice.paid', 'paid', 0, 999, 0],
    ['invoice.payment_failed', 'failed', 999, 0, 0],
    ['invoice.paid', 'paid', -500, 999, -500],
  ])('stores explicit minor units for %s including zero or credits', async (eventType, status, amountPaid, amountDue, expected) => {
    const invoice = invoiceFixture(status)
    invoice.amount_paid = amountPaid
    invoice.amount_due = amountDue
    const { retrieveInvoiceSnapshot } = jest.requireMock('../../lib/stripe')
    retrieveInvoiceSnapshot.mockResolvedValueOnce({
      id: 'in_123', status, amountPaid, amountDue, currency: 'usd', invoicePdf: null, periodStart: 100, periodEnd: 200,
    })
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({ id: `evt_amount_${expected}`, created: 300, type: eventType, data: { object: invoice } })
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({ id: 'local-sub', userId: 'owner-1', status: 'ACTIVE' })
    const { req, res } = webhookRequest()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(prisma.invoice.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ amount: expected }), update: expect.objectContaining({ amount: expected }),
    }))
  })

  test('audits cancellation transitions', async () => {
    const { retrieveSubscriptionSnapshot } = jest.requireMock('../../lib/stripe')
    retrieveSubscriptionSnapshot.mockResolvedValueOnce({ id: 'sub_123', status: 'CANCELLED', priceId: null, currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false })
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({ id: 'evt_cancelled', created: 250, type: 'customer.subscription.deleted', data: { object: { id: 'sub_123' } } })
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({ id: 'local-sub', userId: 'owner-1', status: 'ACTIVE' })
    const { req, res } = webhookRequest()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(prisma.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      status: 'CANCELLED', stripeLastEventCreated: 250, stripeLastEventId: 'evt_cancelled',
    }) }))
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'status_changed', description: expect.stringContaining('CANCELLED') }) }))
  })

  test('does not let an older failed-payment event regress a paid subscription', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({ id: 'evt_failed_old', created: 100, type: 'invoice.payment_failed', data: { object: invoiceFixture('open') } })
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'local-sub', userId: 'owner-1', status: 'ACTIVE', stripeLastEventCreated: 200, stripeLastEventId: 'evt_paid_new',
    })
    const { req, res } = webhookRequest()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(prisma.invoice.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ status: 'paid', amount: 4900 }) }))
    expect(prisma.subscription.update).not.toHaveBeenCalled()
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  test('does not let an older paid invoice resurrect a deleted subscription', async () => {
    const { retrieveInvoiceSnapshot } = jest.requireMock('../../lib/stripe')
    retrieveInvoiceSnapshot.mockResolvedValueOnce({
      id: 'in_123', status: 'failed', amountPaid: 0, amountDue: 4900, currency: 'usd',
      invoicePdf: null, periodStart: 100, periodEnd: 200,
    })
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({ id: 'evt_paid_old', created: 100, type: 'invoice.paid', data: { object: invoiceFixture('paid') } })
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'local-sub', userId: 'owner-1', status: 'CANCELLED', stripeLastEventCreated: 200, stripeLastEventId: 'evt_deleted_new',
    })
    const { req, res } = webhookRequest()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(prisma.invoice.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ status: 'failed', amount: 4900 }) }))
    expect(prisma.subscription.update).not.toHaveBeenCalled()
  })

  test('does not let an older paid event override current failed invoice or past-due subscription truth', async () => {
    const stripe = jest.requireMock('../../lib/stripe')
    stripe.retrieveInvoiceSnapshot.mockResolvedValueOnce({
      id: 'in_123', status: 'failed', amountPaid: 0, amountDue: 4900, currency: 'usd',
      invoicePdf: null, periodStart: 100, periodEnd: 200,
    })
    stripe.retrieveSubscriptionSnapshot.mockResolvedValueOnce({
      id: 'sub_123', status: 'PAST_DUE', priceId: 'price_monthly', currentPeriodStart: 100,
      currentPeriodEnd: 200, cancelAtPeriodEnd: false,
    })
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({ id: 'evt_paid_old', created: 100, type: 'invoice.paid', data: { object: invoiceFixture('paid') } })
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'local-sub', userId: 'owner-1', status: 'PAST_DUE', stripeLastEventCreated: 200, stripeLastEventId: 'evt_failed_new',
    })
    const { req, res } = webhookRequest()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(prisma.invoice.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ status: 'failed', amount: 4900 }) }))
    expect(prisma.subscription.update).not.toHaveBeenCalled()
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  test('does not let an older checkout resurrect a deleted subscription', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({
      id: 'evt_checkout_old', created: 100, type: 'checkout.session.completed',
      data: { object: { metadata: { userId: 'owner-1', priceId: 'price_monthly' }, subscription: 'sub_123', customer: 'cus_123' } },
    })
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'local-sub', userId: 'owner-1', status: 'CANCELLED', stripeLastEventCreated: 200, stripeLastEventId: 'evt_deleted_new',
    })
    const { req, res } = webhookRequest()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(prisma.subscription.upsert).not.toHaveBeenCalled()
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  test('uses authoritative Stripe state instead of event IDs for equal-timestamp deletion', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({ id: 'evt_a', created: 200, type: 'customer.subscription.deleted', data: { object: { id: 'sub_123' } } })
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'local-sub', userId: 'owner-1', status: 'ACTIVE', stripeLastEventCreated: 200, stripeLastEventId: 'evt_z',
    })
    const { req, res } = webhookRequest()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(prisma.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) }))
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  test('uses authoritative Stripe state for equal-timestamp failed payment', async () => {
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({ id: 'evt_failed_same', created: 200, type: 'invoice.payment_failed', data: { object: invoiceFixture('failed') } })
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'local-sub', userId: 'owner-1', status: 'ACTIVE', stripeLastEventCreated: 200, stripeLastEventId: 'evt_paid_same',
    })
    const { req, res } = webhookRequest()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(prisma.invoice.upsert).toHaveBeenCalled()
    expect(prisma.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) }))
  })

  test('uses authoritative Stripe state for equal-timestamp checkout', async () => {
    const { retrieveSubscriptionSnapshot } = jest.requireMock('../../lib/stripe')
    retrieveSubscriptionSnapshot.mockResolvedValueOnce({ id: 'sub_123', status: 'CANCELLED', priceId: null, currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false })
    ;(constructWebhookEvent as jest.Mock).mockReturnValue({
      id: 'evt_checkout_same', created: 200, type: 'checkout.session.completed',
      data: { object: { metadata: { userId: 'owner-1', priceId: 'price_monthly' }, subscription: 'sub_123', customer: 'cus_123' } },
    })
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'local-sub', userId: 'owner-1', status: 'CANCELLED', stripeLastEventCreated: 200, stripeLastEventId: 'evt_deleted_same',
    })
    ;(prisma.subscription.upsert as jest.Mock).mockResolvedValue({ id: 'local-sub', status: 'CANCELLED' })
    const { req, res } = webhookRequest()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ status: 'CANCELLED' }) }))
  })
})

function webhookRequest() {
  const mocks = createMocks<NextApiRequest, NextApiResponse>({ method: 'POST', headers: { 'stripe-signature': 'valid-signature' } })
  Object.assign(mocks.req, { async *[Symbol.asyncIterator]() { yield Buffer.from('{}') } })
  return mocks
}

function invoiceFixture(status: string) {
  return {
    id: 'in_123', status, amount_paid: status === 'paid' ? 4900 : 0, amount_due: 4900,
    currency: 'usd', invoice_pdf: 'https://stripe.test/invoice.pdf', period_start: 100, period_end: 200,
    parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_123' } },
  }
}
