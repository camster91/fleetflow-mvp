import {
  getBillingAvailability,
  getCanonicalAppUrl,
  getConfiguredPricing,
  retrieveInvoiceSnapshot,
  retrieveSubscriptionSnapshot,
  stripe,
} from '@/lib/stripe'

const NAMES = [
  'NEXTAUTH_URL',
  'APP_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_MONTHLY',
  'STRIPE_PRICE_YEARLY',
  'STRIPE_PRICE_MONTHLY_AMOUNT',
  'STRIPE_PRICE_YEARLY_AMOUNT',
  'STRIPE_PRICE_CURRENCY',
] as const

describe('Stripe launch configuration', () => {
  const original = Object.fromEntries(NAMES.map((name) => [name, process.env[name]]))
  afterEach(() => {
    jest.restoreAllMocks()
    NAMES.forEach((name) => {
      if (original[name] === undefined) delete process.env[name]
      else process.env[name] = original[name]
    })
  })

  it.each([
    'http://fleetvera.example',
    'javascript:alert(1)',
    'https://user:pass@fleetvera.example',
    'https://fleetvera.example?redirect=evil',
  ])('rejects unsafe canonical app URL %s', (value) => {
    process.env.NEXTAUTH_URL = value
    expect(getCanonicalAppUrl()).toBeNull()
  })

  it('normalizes a canonical HTTPS URL to its approved origin', () => {
    process.env.NEXTAUTH_URL = 'https://fleetvera.example/path/'
    expect(getCanonicalAppUrl()).toBe('https://fleetvera.example')
  })

  it('requires exact integer minor-unit pricing and an allowed currency', () => {
    process.env.STRIPE_PRICE_MONTHLY_AMOUNT = '4900'
    process.env.STRIPE_PRICE_YEARLY_AMOUNT = '49000'
    process.env.STRIPE_PRICE_CURRENCY = 'cad'
    expect(getConfiguredPricing()).toEqual({
      monthly: { amount: 4900, currency: 'CAD' },
      yearly: { amount: 49000, currency: 'CAD' },
    })
    process.env.STRIPE_PRICE_MONTHLY_AMOUNT = '49.99'
    expect(getConfiguredPricing()).toBeNull()
  })

  it('is unavailable unless Stripe, pricing, and HTTPS origin are all valid', () => {
    Object.assign(process.env, {
      NEXTAUTH_URL: 'https://fleetvera.example',
      STRIPE_SECRET_KEY: 'sk_test',
      STRIPE_WEBHOOK_SECRET: 'whsec_test',
      STRIPE_PRICE_MONTHLY: 'price_monthly',
      STRIPE_PRICE_YEARLY: 'price_yearly',
      STRIPE_PRICE_MONTHLY_AMOUNT: '4900',
      STRIPE_PRICE_YEARLY_AMOUNT: '49000',
      STRIPE_PRICE_CURRENCY: 'CAD',
    })
    expect(getBillingAvailability().available).toBe(true)
    process.env.NEXTAUTH_URL = 'http://fleetvera.example'
    expect(getBillingAvailability().available).toBe(false)
  })

  it('returns a provider-neutral subscription snapshot', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test'
    jest.spyOn(stripe.subscriptions, 'retrieve').mockResolvedValueOnce({
      id: 'sub_123',
      status: 'past_due',
      cancel_at_period_end: true,
      items: { data: [{ price: { id: 'price_monthly' }, current_period_start: 100, current_period_end: 200 }] },
    } as never)
    await expect(retrieveSubscriptionSnapshot('sub_123')).resolves.toEqual({
      id: 'sub_123',
      status: 'PAST_DUE',
      priceId: 'price_monthly',
      currentPeriodStart: 100,
      currentPeriodEnd: 200,
      cancelAtPeriodEnd: true,
    })
  })

  it('represents a provider resource_missing response as cancelled', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test'
    jest
      .spyOn(stripe.subscriptions, 'retrieve')
      .mockRejectedValueOnce(Object.assign(new Error('raw provider message'), { code: 'resource_missing' }))
    await expect(retrieveSubscriptionSnapshot('sub_missing')).resolves.toEqual({
      id: 'sub_missing',
      status: 'CANCELLED',
      priceId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    })
  })

  it.each([
    [{ paid: true, status: 'open' }, 'paid'],
    [{ paid: false, status: 'paid' }, 'paid'],
    [{ paid: false, status: 'uncollectible' }, 'failed'],
    [{ paid: false, status: 'open' }, 'open'],
    [{ paid: false, status: 'void' }, 'void'],
  ])('maps authoritative invoice state %# to %s', async (state, expected) => {
    process.env.STRIPE_SECRET_KEY = 'sk_test'
    jest.spyOn(stripe.invoices, 'retrieve').mockResolvedValueOnce({
      id: 'in_123',
      ...state,
      amount_paid: 0,
      amount_due: 4900,
      currency: 'cad',
      invoice_pdf: null,
      period_start: 100,
      period_end: 200,
    } as never)
    await expect(retrieveInvoiceSnapshot('in_123')).resolves.toEqual(
      expect.objectContaining({ status: expected, amountPaid: 0, amountDue: 4900 })
    )
  })

  it('sanitizes invoice reconciliation failures', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test'
    jest.spyOn(stripe.invoices, 'retrieve').mockRejectedValueOnce(new Error('raw provider secret'))
    await expect(retrieveInvoiceSnapshot('in_123')).rejects.toThrow('Stripe invoice reconciliation failed')
  })
})
