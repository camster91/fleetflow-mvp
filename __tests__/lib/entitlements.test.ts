import type { NextApiRequest } from 'next'

jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: jest.fn() } } }))

import {
  betaEndsAt,
  billingEnforced,
  computeEntitlement,
  getWorkspaceEntitlement,
  isWriteSubjectToEntitlement,
  PAST_DUE_GRACE_DAYS,
  TRIAL_DAYS,
  type SubscriptionFacts,
} from '@/lib/entitlements'
import { prisma } from '@/lib/prisma'

const DAY = 86_400_000
const now = new Date('2027-03-01T12:00:00Z')
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY)
const daysFromNow = (days: number) => new Date(now.getTime() + days * DAY)

function paid(overrides: Partial<SubscriptionFacts>): SubscriptionFacts {
  return {
    status: 'ACTIVE',
    stripeSubscriptionId: 'sub_1',
    currentPeriodStart: daysAgo(10),
    currentPeriodEnd: daysFromNow(20),
    cancelAtPeriodEnd: false,
    pastDueSince: null,
    updatedAt: daysAgo(1),
    ...overrides,
  }
}

const BILLING_ENV = {
  STRIPE_SECRET_KEY: 'sk_test_x',
  STRIPE_WEBHOOK_SECRET: 'whsec_x',
  STRIPE_PRICE_MONTHLY: 'price_m',
  STRIPE_PRICE_YEARLY: 'price_y',
  STRIPE_PRICE_MONTHLY_AMOUNT: '4900',
  STRIPE_PRICE_YEARLY_AMOUNT: '49000',
  STRIPE_PRICE_CURRENCY: 'CAD',
  NEXTAUTH_URL: 'https://fleet.example.test',
}

describe('computeEntitlement: the #150 policy', () => {
  it.each([
    ['trial, day 1', null, daysAgo(1), 'FULL', 'TRIAL'],
    ['trial, last day', null, daysAgo(TRIAL_DAYS - 1), 'FULL', 'TRIAL'],
    ['trial expired', null, daysAgo(TRIAL_DAYS + 1), 'READ_ONLY', 'TRIAL_EXPIRED'],
    [
      'checkout placeholder without a Stripe subscription is still a trial',
      paid({ status: 'TRIAL', stripeSubscriptionId: null }),
      daysAgo(TRIAL_DAYS + 1),
      'READ_ONLY',
      'TRIAL_EXPIRED',
    ],
    ['active', paid({}), daysAgo(400), 'FULL', 'ACTIVE'],
    ['active, cancelling at period end', paid({ cancelAtPeriodEnd: true }), daysAgo(400), 'FULL', 'CANCELLING'],
    [
      'past due within the grace period',
      paid({ status: 'PAST_DUE', pastDueSince: daysAgo(PAST_DUE_GRACE_DAYS - 1) }),
      daysAgo(400),
      'FULL',
      'PAYMENT_GRACE',
    ],
    [
      'past due beyond the grace period',
      paid({ status: 'PAST_DUE', pastDueSince: daysAgo(PAST_DUE_GRACE_DAYS + 1) }),
      daysAgo(400),
      'READ_ONLY',
      'PAYMENT_OVERDUE',
    ],
    [
      'unpaid (Stripe stopped retrying) is read-only even inside the grace window',
      paid({ status: 'UNPAID', pastDueSince: daysAgo(2) }),
      daysAgo(400),
      'READ_ONLY',
      'PAYMENT_OVERDUE',
    ],
    [
      'cancelled with paid time left',
      paid({ status: 'CANCELLED', currentPeriodEnd: daysFromNow(5) }),
      daysAgo(400),
      'FULL',
      'CANCELLING',
    ],
    [
      'cancelled after the paid period',
      paid({ status: 'CANCELLED', currentPeriodEnd: daysAgo(1) }),
      daysAgo(400),
      'READ_ONLY',
      'CANCELLED',
    ],
    [
      'cancelled without a period end (deleted in Stripe)',
      paid({ status: 'CANCELLED', currentPeriodEnd: null }),
      daysAgo(400),
      'READ_ONLY',
      'CANCELLED',
    ],
  ] as const)('%s', (_label, subscription, ownerCreatedAt, access, reason) => {
    const result = computeEntitlement(subscription, ownerCreatedAt, now)
    expect(result).toMatchObject({ enforced: true, access, reason })
  })

  it('ends access with the payment grace period when Stripe cancels after failed payments', () => {
    const cancelled = paid({ status: 'CANCELLED', pastDueSince: daysAgo(14), currentPeriodEnd: daysFromNow(16) })
    expect(computeEntitlement(cancelled, daysAgo(400), now)).toMatchObject({
      access: 'READ_ONLY',
      reason: 'CANCELLED',
      readOnlySince: daysAgo(14 - PAST_DUE_GRACE_DAYS),
    })
    // Still inside the grace period: full access until the grace ends, not the unpaid period end.
    const recent = paid({ status: 'CANCELLED', pastDueSince: daysAgo(2), currentPeriodEnd: daysFromNow(28) })
    expect(computeEntitlement(recent, daysAgo(400), now)).toMatchObject({
      access: 'FULL',
      accessEndsAt: daysFromNow(PAST_DUE_GRACE_DAYS - 2),
    })
  })

  it('keeps the trial while a first payment is incomplete (e.g. awaiting 3-D Secure)', () => {
    const incomplete = paid({ status: 'INCOMPLETE' })
    expect(computeEntitlement(incomplete, daysAgo(3), now)).toMatchObject({ access: 'FULL', reason: 'TRIAL' })
    expect(computeEntitlement(incomplete, daysAgo(30), now)).toMatchObject({ reason: 'TRIAL_EXPIRED' })
  })

  it('reports when the trial ended as the read-only start', () => {
    const created = daysAgo(30)
    const result = computeEntitlement(null, created, now)
    expect(result.trialEndsAt).toEqual(new Date(created.getTime() + TRIAL_DAYS * DAY))
    expect(result.readOnlySince).toEqual(result.trialEndsAt)
  })

  it('measures grace from the first failure, falling back to the billing period start', () => {
    const withStart = computeEntitlement(paid({ status: 'PAST_DUE', pastDueSince: daysAgo(3) }), daysAgo(400), now)
    expect(withStart.graceEndsAt).toEqual(daysFromNow(PAST_DUE_GRACE_DAYS - 3))
    const legacy = computeEntitlement(
      paid({ status: 'PAST_DUE', pastDueSince: null, currentPeriodStart: daysAgo(10) }),
      daysAgo(400),
      now
    )
    expect(legacy).toMatchObject({ access: 'READ_ONLY', graceEndsAt: daysAgo(10 - PAST_DUE_GRACE_DAYS) })
  })

  it('grandfathers beta workspaces until the announced beta end date', () => {
    const beta = daysFromNow(30)
    expect(computeEntitlement(null, daysAgo(200), now, beta)).toMatchObject({
      access: 'FULL',
      reason: 'TRIAL',
      trialEndsAt: beta,
    })
    // After the beta ends, workspaces created before it are read-only; new sign-ups still get 14 days.
    const later = daysFromNow(31)
    expect(computeEntitlement(null, daysAgo(200), later, beta).access).toBe('READ_ONLY')
    expect(computeEntitlement(null, daysFromNow(29), later, beta).access).toBe('FULL')
  })
})

describe('isWriteSubjectToEntitlement', () => {
  const request = (method: string, url: string) => ({ method, url }) as NextApiRequest

  it.each(['GET', 'HEAD', 'OPTIONS'])('never checks %s (viewing and exports stay open)', (method) => {
    expect(isWriteSubjectToEntitlement(request(method, '/api/vehicles'), 'OWNER')).toBe(false)
    expect(isWriteSubjectToEntitlement(request(method, '/api/reports/export?type=fleet'), 'OWNER')).toBe(false)
  })

  it.each([
    ['POST', '/api/vehicles'],
    ['PUT', '/api/deliveries/d1'],
    ['DELETE', '/api/maintenance/m1'],
    ['PATCH', '/api/intelligence/findings'],
    ['PATCH', '/api/deliveries/d1/status'],
  ])('checks business writes: %s %s', (method, url) => {
    expect(isWriteSubjectToEntitlement(request(method, url), 'MANAGER')).toBe(true)
  })

  it.each([
    '/api/stripe/checkout-session',
    '/api/subscription/cancel',
    '/api/settings/workspace',
    '/api/settings/api-keys',
    '/api/team/invite',
    '/api/admin/email/settings',
    '/api/assistant/query',
    '/api/assistant/entities',
    '/api/ai/query',
  ])('keeps billing, settings, team, admin and assistant questions writable: POST %s', (url) => {
    expect(isWriteSubjectToEntitlement(request('POST', url), 'OWNER')).toBe(false)
  })

  it.each([
    ['POST', '/api/assistant/actions/execute'],
    ['POST', '/api/integrations/quickbooks/connect'],
    ['POST', '/api/integrations/quickbooks/sync'],
    ['PATCH', '/api/integrations/records'],
  ])('blocks assistant actions and integration writes: %s %s', (method, url) => {
    expect(isWriteSubjectToEntitlement(request(method, url), 'OWNER')).toBe(true)
  })

  it('still allows disconnecting an integration', () => {
    expect(isWriteSubjectToEntitlement(request('DELETE', '/api/integrations/quickbooks/connect'), 'OWNER')).toBe(false)
  })

  it('lets drivers keep updating their assigned deliveries, and only that', () => {
    expect(isWriteSubjectToEntitlement(request('PATCH', '/api/deliveries/d1/status'), 'DRIVER')).toBe(false)
    expect(isWriteSubjectToEntitlement(request('PUT', '/api/deliveries/d1'), 'DRIVER')).toBe(true)
    expect(isWriteSubjectToEntitlement(request('PATCH', '/api/deliveries/d1/status'), 'DISPATCHER')).toBe(true)
  })
})

describe('billingEnforced and betaEndsAt', () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
  })

  it('is on only in public mode with Stripe checkout configured', () => {
    Object.assign(process.env, BILLING_ENV, { FLEETVERA_RELEASE_MODE: 'public' })
    expect(billingEnforced()).toBe(true)
    process.env.FLEETVERA_RELEASE_MODE = 'pilot'
    expect(billingEnforced()).toBe(false)
    delete process.env.FLEETVERA_RELEASE_MODE
    expect(billingEnforced()).toBe(false)
    // Public mode but nobody can pay: never lock workspaces out.
    process.env.FLEETVERA_RELEASE_MODE = 'public'
    delete process.env.STRIPE_PRICE_MONTHLY
    expect(billingEnforced()).toBe(false)
  })

  it('reads a valid beta end date and ignores an invalid one', () => {
    expect(betaEndsAt({ FLEETVERA_BETA_ENDS_AT: '2027-01-31T00:00:00Z' })).toEqual(new Date('2027-01-31T00:00:00Z'))
    expect(betaEndsAt({ FLEETVERA_BETA_ENDS_AT: 'soon' })).toBeNull()
    expect(betaEndsAt({})).toBeNull()
  })
})

describe('getWorkspaceEntitlement', () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
    jest.clearAllMocks()
  })

  it('does not touch the database while billing is not enforced', async () => {
    delete process.env.FLEETVERA_RELEASE_MODE
    await expect(getWorkspaceEntitlement('owner')).resolves.toMatchObject({ enforced: false, access: 'FULL' })
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('evaluates the owner subscription in public mode with billing configured', async () => {
    Object.assign(process.env, BILLING_ENV, { FLEETVERA_RELEASE_MODE: 'public' })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ createdAt: daysAgo(30), subscription: null })
    await expect(getWorkspaceEntitlement('owner', now)).resolves.toMatchObject({
      enforced: true,
      access: 'READ_ONLY',
      reason: 'TRIAL_EXPIRED',
    })
    expect((prisma.user.findUnique as jest.Mock).mock.calls[0][0].where).toEqual({ id: 'owner' })
  })

  it('fails open when the owner record is missing', async () => {
    Object.assign(process.env, BILLING_ENV, { FLEETVERA_RELEASE_MODE: 'public' })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
    await expect(getWorkspaceEntitlement('owner', now)).resolves.toMatchObject({ access: 'FULL' })
  })
})
