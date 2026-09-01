import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

export const stripe = new Stripe(STRIPE_SECRET_KEY || 'sk_test_not_configured', {
  apiVersion: '2026-02-25.clover',
  typescript: true,
});

export const STRIPE_WEBHOOK_SECRET_KEY = process.env.STRIPE_WEBHOOK_SECRET;

export type BillingInterval = 'monthly' | 'yearly'

export interface BillingPricing {
  monthly: { amount: number; currency: string }
  yearly: { amount: number; currency: string }
}

export interface StripeSubscriptionSnapshot {
  id: string
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'UNPAID' | 'TRIAL'
  priceId: string | null
  currentPeriodStart: number | null
  currentPeriodEnd: number | null
  cancelAtPeriodEnd: boolean
}

export interface StripeInvoiceSnapshot {
  id: string
  status: 'paid' | 'failed' | 'open' | 'void'
  amountPaid: number
  amountDue: number
  currency: string
  invoicePdf: string | null
  periodStart: number
  periodEnd: number
}

const SUPPORTED_CURRENCIES = new Set(['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'NZD'])

export function getCanonicalAppUrl(): string | null {
  const configured = (process.env.NEXTAUTH_URL || process.env.APP_URL)?.trim()
  if (!configured) return null
  try {
    const url = new URL(configured)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null
    return url.origin
  } catch {
    return null
  }
}

export function getConfiguredPricing(): BillingPricing | null {
  const monthly = Number(process.env.STRIPE_PRICE_MONTHLY_AMOUNT)
  const yearly = Number(process.env.STRIPE_PRICE_YEARLY_AMOUNT)
  const currency = process.env.STRIPE_PRICE_CURRENCY?.trim().toUpperCase()
  if (!Number.isSafeInteger(monthly) || monthly < 0 || !Number.isSafeInteger(yearly) || yearly < 0 || !currency || !SUPPORTED_CURRENCIES.has(currency)) return null
  return { monthly: { amount: monthly, currency }, yearly: { amount: yearly, currency } }
}

export function getBillingAvailability() {
  const required = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_MONTHLY', 'STRIPE_PRICE_YEARLY', 'STRIPE_PRICE_MONTHLY_AMOUNT', 'STRIPE_PRICE_YEARLY_AMOUNT', 'STRIPE_PRICE_CURRENCY'] as const
  const missing = required.filter((name) => !process.env[name]?.trim())
  const pricing = getConfiguredPricing()
  const canonicalUrl = getCanonicalAppUrl()
  return { available: missing.length === 0 && Boolean(pricing) && Boolean(canonicalUrl), missing, pricing, canonicalUrl }
}

export function getConfiguredPrice(interval: BillingInterval): string | null {
  return (interval === 'yearly' ? process.env.STRIPE_PRICE_YEARLY : process.env.STRIPE_PRICE_MONTHLY)?.trim() || null
}

export function resolvePricePlan(priceId: string): 'UNLIMITED' | null {
  const configured = [getConfiguredPrice('monthly'), getConfiguredPrice('yearly')].filter(Boolean)
  return configured.includes(priceId) ? 'UNLIMITED' : null
}

function requireStripeSecret(name: 'STRIPE_SECRET_KEY' | 'STRIPE_WEBHOOK_SECRET'): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error('Stripe is not configured')
  return value
}

// Helper function to create a checkout session for subscription
export async function createCheckoutSession({
  priceId,
  customerId,
  userId,
  successUrl,
  cancelUrl,
  trialDays = 0,
  idempotencyKey,
}: {
  priceId: string;
  customerId?: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
  idempotencyKey?: string;
}) {
  requireStripeSecret('STRIPE_SECRET_KEY')
  const sessionConfig: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
      priceId,
    },
    subscription_data: {
      metadata: {
        userId,
        priceId,
      },
      ...(trialDays > 0 && {
        trial_period_days: trialDays,
      }),
    },
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    tax_id_collection: {
      enabled: true,
    },
  };

  // If customer exists, use it; otherwise, create a new customer on checkout
  if (customerId) {
    sessionConfig.customer = customerId;
  } else {
    sessionConfig.customer_creation = 'always';
  }

  return idempotencyKey
    ? stripe.checkout.sessions.create(sessionConfig, { idempotencyKey })
    : stripe.checkout.sessions.create(sessionConfig);
}

// Helper function to create a customer portal session
export async function createCustomerPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}) {
  requireStripeSecret('STRIPE_SECRET_KEY')
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session;
}

// Helper function to create a Stripe customer
export async function createStripeCustomer({
  email,
  name,
  userId,
  idempotencyKey,
}: {
  email: string;
  name?: string;
  userId: string;
  idempotencyKey?: string;
}) {
  requireStripeSecret('STRIPE_SECRET_KEY')
  const params: Stripe.CustomerCreateParams = {
    email,
    name,
    metadata: { userId },
  }
  return idempotencyKey
    ? stripe.customers.create(params, { idempotencyKey })
    : stripe.customers.create(params);
}

export async function findOpenCheckoutSessions(customerId: string, userId: string) {
  requireStripeSecret('STRIPE_SECRET_KEY')
  const sessions = await stripe.checkout.sessions.list({
    customer: customerId,
    status: 'open',
    limit: 10,
  })
  return sessions.data.filter(session =>
    session.mode === 'subscription'
    && session.metadata?.userId === userId
    && Boolean(session.url)
  )
}

export async function expireCheckoutSession(sessionId: string) {
  requireStripeSecret('STRIPE_SECRET_KEY')
  return stripe.checkout.sessions.expire(sessionId)
}

// Helper function to retrieve a Stripe customer
export async function getStripeCustomer(customerId: string) {
  requireStripeSecret('STRIPE_SECRET_KEY')
  return await stripe.customers.retrieve(customerId);
}

// Helper function to cancel a subscription
export async function cancelSubscription(
  subscriptionId: string,
  atPeriodEnd: boolean = true
) {
  requireStripeSecret('STRIPE_SECRET_KEY')
  if (atPeriodEnd) {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  } else {
    return await stripe.subscriptions.cancel(subscriptionId);
  }
}

// Helper function to update subscription
export async function updateSubscription(
  subscriptionId: string,
  newPriceId: string
) {
  requireStripeSecret('STRIPE_SECRET_KEY')
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  
  const itemId = subscription.items.data[0]?.id;
  if (!itemId) {
    throw new Error('Subscription has no items');
  }

  return await stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: itemId,
        price: newPriceId,
      },
    ],
    proration_behavior: 'create_prorations',
  });
}

// Helper function to construct event from webhook payload
export function constructWebhookEvent(payload: string | Buffer, signature: string) {
  return stripe.webhooks.constructEvent(payload, signature, requireStripeSecret('STRIPE_WEBHOOK_SECRET'));
}

export async function retrieveSubscriptionSnapshot(subscriptionId: string): Promise<StripeSubscriptionSnapshot> {
  requireStripeSecret('STRIPE_SECRET_KEY')
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const item = subscription.items.data[0]
    const statusMap: Record<string, StripeSubscriptionSnapshot['status']> = {
      active: 'ACTIVE', past_due: 'PAST_DUE', canceled: 'CANCELLED', unpaid: 'UNPAID', trialing: 'TRIAL',
      incomplete: 'UNPAID', incomplete_expired: 'UNPAID', paused: 'UNPAID',
    }
    return {
      id: subscription.id,
      status: statusMap[subscription.status] || 'UNPAID',
      priceId: item?.price?.id || null,
      currentPeriodStart: item?.current_period_start || null,
      currentPeriodEnd: item?.current_period_end || null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'resource_missing') {
      return { id: subscriptionId, status: 'CANCELLED', priceId: null, currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false }
    }
    throw new Error('Stripe subscription reconciliation failed')
  }
}

export async function retrieveInvoiceSnapshot(invoiceId: string): Promise<StripeInvoiceSnapshot> {
  requireStripeSecret('STRIPE_SECRET_KEY')
  try {
    const invoice = await stripe.invoices.retrieve(invoiceId)
    const legacyPaid = (invoice as Stripe.Invoice & { paid?: boolean }).paid
    const status: StripeInvoiceSnapshot['status'] = legacyPaid || invoice.status === 'paid'
      ? 'paid'
      : invoice.status === 'uncollectible'
        ? 'failed'
        : invoice.status === 'void'
          ? 'void'
          : 'open'
    return {
      id: invoice.id,
      status,
      amountPaid: invoice.amount_paid,
      amountDue: invoice.amount_due,
      currency: invoice.currency,
      invoicePdf: invoice.invoice_pdf || null,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
    }
  } catch {
    throw new Error('Stripe invoice reconciliation failed')
  }
}

export default stripe;
