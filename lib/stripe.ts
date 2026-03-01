import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY is not set. Stripe functionality will be disabled.');
}

export const stripe = new Stripe(STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-02-25.clover',
  typescript: true,
});

export const STRIPE_WEBHOOK_SECRET_KEY = STRIPE_WEBHOOK_SECRET;

// Helper function to create a checkout session for subscription
export async function createCheckoutSession({
  priceId,
  customerId,
  userId,
  successUrl,
  cancelUrl,
  trialDays = 0,
}: {
  priceId: string;
  customerId?: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
}) {
  const sessionConfig: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    payment_method_types: ['card'],
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
    },
    subscription_data: {
      metadata: {
        userId,
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

  const session = await stripe.checkout.sessions.create(sessionConfig);
  return session;
}

// Helper function to create a customer portal session
export async function createCustomerPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}) {
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
}: {
  email: string;
  name?: string;
  userId: string;
}) {
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      userId,
    },
  });
  return customer;
}

// Helper function to retrieve a Stripe customer
export async function getStripeCustomer(customerId: string) {
  return await stripe.customers.retrieve(customerId);
}

// Helper function to cancel a subscription
export async function cancelSubscription(
  subscriptionId: string,
  atPeriodEnd: boolean = true
) {
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
  if (!STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  }
  return stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
}

export default stripe;
