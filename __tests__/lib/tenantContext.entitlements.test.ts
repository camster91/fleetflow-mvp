import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/auth', () => ({ getServerSession: jest.fn(), authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: { team: { findMany: jest.fn() }, user: { findUnique: jest.fn() } },
}))

import { requireTenantContext } from '@/lib/apiAuth'
import { getServerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const DAY = 86_400_000
const ago = (days: number) => new Date(Date.now() - days * DAY)
const ahead = (days: number) => new Date(Date.now() + days * DAY)

const BILLING_ENV = {
  FLEETVERA_RELEASE_MODE: 'public',
  STRIPE_SECRET_KEY: 'sk_test_x',
  STRIPE_WEBHOOK_SECRET: 'whsec_x',
  STRIPE_PRICE_MONTHLY: 'price_m',
  STRIPE_PRICE_YEARLY: 'price_y',
  STRIPE_PRICE_MONTHLY_AMOUNT: '4900',
  STRIPE_PRICE_YEARLY_AMOUNT: '49000',
  STRIPE_PRICE_CURRENCY: 'CAD',
  NEXTAUTH_URL: 'https://fleet.example.test',
}

const paid = (overrides: Record<string, unknown>) => ({
  status: 'ACTIVE',
  stripeSubscriptionId: 'sub_1',
  currentPeriodStart: ago(10),
  currentPeriodEnd: ahead(20),
  cancelAtPeriodEnd: false,
  pastDueSince: null,
  updatedAt: ago(1),
  ...overrides,
})

// The #150 acceptance matrix: subscription state x {read, write, driver status, billing/settings}.
const STATES = [
  ['trial active', ago(3), null, 'FULL'],
  ['trial expired', ago(30), null, 'READ_ONLY'],
  ['active', ago(400), paid({}), 'FULL'],
  ['past due, in grace', ago(400), paid({ status: 'PAST_DUE', pastDueSince: ago(3) }), 'FULL'],
  ['past due, grace expired', ago(400), paid({ status: 'PAST_DUE', pastDueSince: ago(8) }), 'READ_ONLY'],
  ['cancelled, paid time left', ago(400), paid({ status: 'CANCELLED', currentPeriodEnd: ahead(3) }), 'FULL'],
  ['cancelled, period over', ago(400), paid({ status: 'CANCELLED', currentPeriodEnd: ago(1) }), 'READ_ONLY'],
] as const

function signedInAs(role: 'OWNER' | 'DRIVER') {
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: role === 'OWNER' ? 'owner' : 'driver' } })
  ;(prisma.team.findMany as jest.Mock).mockResolvedValue([
    { id: 'team-1', ownerId: 'owner', members: role === 'OWNER' ? [] : [{ role: 'DRIVER' }] },
  ])
}

async function call(method: string, url: string) {
  const { req, res } = createMocks({ method: method as never, url })
  const context = await requireTenantContext(req as never, res as never)
  return { context, res }
}

describe('requireTenantContext plan enforcement', () => {
  const saved = { ...process.env }
  beforeEach(() => {
    jest.clearAllMocks()
    Object.assign(process.env, BILLING_ENV)
  })
  afterAll(() => {
    process.env = { ...saved }
  })

  describe.each(STATES)('%s', (_label, ownerCreatedAt, subscription, access) => {
    beforeEach(() => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ createdAt: ownerCreatedAt, subscription })
    })

    it('always allows reads and exports', async () => {
      signedInAs('OWNER')
      for (const url of ['/api/vehicles', '/api/reports/export?type=fleet', '/api/subscription/status']) {
        const { context } = await call('GET', url)
        expect(context).not.toBeNull()
      }
      expect(prisma.user.findUnique).not.toHaveBeenCalled()
    })

    it(`${access === 'FULL' ? 'allows' : 'blocks'} business writes`, async () => {
      signedInAs('OWNER')
      const { context, res } = await call('POST', '/api/vehicles')
      if (access === 'FULL') {
        expect(context).not.toBeNull()
      } else {
        expect(context).toBeNull()
        expect(res._getStatusCode()).toBe(402)
        expect(res._getJSONData()).toMatchObject({ code: 'SUBSCRIPTION_REQUIRED' })
        expect(res._getJSONData().error).toMatch(/read-only.*export/)
      }
      expect((prisma.user.findUnique as jest.Mock).mock.calls[0][0].where).toEqual({ id: 'owner' })
    })

    it('keeps billing, settings and team management writable', async () => {
      signedInAs('OWNER')
      for (const url of ['/api/stripe/checkout-session', '/api/subscription/cancel', '/api/settings/workspace']) {
        const { context } = await call('POST', url)
        expect(context).not.toBeNull()
      }
    })

    it('lets a driver update an assigned delivery status but not edit deliveries', async () => {
      signedInAs('DRIVER')
      expect((await call('PATCH', '/api/deliveries/d1/status')).context).not.toBeNull()
      const edit = await call('PUT', '/api/deliveries/d1')
      expect(edit.context === null).toBe(access === 'READ_ONLY')
    })
  })

  it('never enforces in pilot mode (the free beta)', async () => {
    process.env.FLEETVERA_RELEASE_MODE = 'pilot'
    signedInAs('OWNER')
    const { context } = await call('POST', '/api/vehicles')
    expect(context).not.toBeNull()
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })
})
