import type { NextApiRequest, NextApiResponse } from 'next';
import { stripe, constructWebhookEvent } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { getPlanTypeFromStripePriceId } from '@/config/pricing';
import { PlanType, SubscriptionStatus } from '@/lib/subscription';
import Stripe from 'stripe';

// Disable body parsing for raw body access
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to get raw body
async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    let event: Stripe.Event;

    try {
      event = constructWebhookEvent(rawBody, signature);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    console.log('Processing webhook event:', event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(subscription);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ 
      error: 'Webhook processing failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const stripeCustomerId = session.customer as string;
  const stripeSubscriptionId = session.subscription as string;

  if (!userId || !stripeSubscriptionId) {
    console.error('Missing userId or subscription ID in session metadata');
    return;
  }

  // Get subscription details from Stripe
  const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const priceId = stripeSubscription.items.data[0]?.price.id;
  
  if (!priceId) {
    console.error('No price ID found in subscription');
    return;
  }

  const planType = getPlanTypeFromStripePriceId(priceId);

  // Update subscription in database
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId: priceId,
      plan: planType,
      status: 'ACTIVE' as SubscriptionStatus,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    },
    update: {
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId: priceId,
      plan: planType,
      status: 'ACTIVE' as SubscriptionStatus,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      trialEndsAt: null, // Clear trial end date when converting to paid
    },
  });

  console.log(`Subscription activated for user ${userId}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const stripeCustomerId = invoice.customer as string;
  const stripeSubscriptionId = invoice.subscription as string;

  if (!stripeCustomerId) {
    console.error('No customer ID in invoice');
    return;
  }

  // Find subscription by customer ID
  const subscription = await prisma.subscription.findUnique({
    where: { stripeCustomerId },
    include: { user: true },
  });

  if (!subscription) {
    console.error('No subscription found for customer:', stripeCustomerId);
    return;
  }

  // Create or update invoice record
  await prisma.invoice.upsert({
    where: { stripeInvoiceId: invoice.id },
    create: {
      userId: subscription.userId,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_paid / 100, // Convert from cents
      currency: invoice.currency.toUpperCase(),
      status: invoice.status || 'paid',
      invoicePdf: invoice.invoice_pdf,
      periodStart: new Date((invoice.period_start || invoice.created) * 1000),
      periodEnd: new Date((invoice.period_end || invoice.created) * 1000),
    },
    update: {
      status: invoice.status || 'paid',
      invoicePdf: invoice.invoice_pdf,
    },
  });

  // Update subscription status to active if it was past_due or unpaid
  if (subscription.status === 'PAST_DUE' || subscription.status === 'UNPAID') {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'ACTIVE' },
    });
  }

  console.log(`Invoice paid for user ${subscription.userId}`);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const stripeCustomerId = invoice.customer as string;

  if (!stripeCustomerId) {
    console.error('No customer ID in invoice');
    return;
  }

  // Find subscription by customer ID
  const subscription = await prisma.subscription.findUnique({
    where: { stripeCustomerId },
  });

  if (!subscription) {
    console.error('No subscription found for customer:', stripeCustomerId);
    return;
  }

  // Update subscription status to past_due
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: 'PAST_DUE' },
  });

  console.log(`Payment failed for user ${subscription.userId}`);
}

async function handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription) {
  const stripeCustomerId = stripeSubscription.customer as string;
  const priceId = stripeSubscription.items.data[0]?.price.id;

  if (!stripeCustomerId || !priceId) {
    console.error('Missing customer or price ID');
    return;
  }

  const planType = getPlanTypeFromStripePriceId(priceId);

  // Determine status
  let status: SubscriptionStatus = 'ACTIVE';
  if (stripeSubscription.status === 'past_due') {
    status = 'PAST_DUE';
  } else if (stripeSubscription.status === 'unpaid') {
    status = 'UNPAID';
  } else if (stripeSubscription.status === 'canceled') {
    status = 'CANCELLED';
  }

  // Update subscription
  await prisma.subscription.updateMany({
    where: { stripeCustomerId },
    data: {
      plan: planType,
      status,
      stripePriceId: priceId,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    },
  });

  console.log(`Subscription updated for customer ${stripeCustomerId}`);
}

async function handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
  const stripeCustomerId = stripeSubscription.customer as string;

  if (!stripeCustomerId) {
    console.error('No customer ID in subscription');
    return;
  }

  // Update subscription to cancelled
  await prisma.subscription.updateMany({
    where: { stripeCustomerId },
    data: {
      status: 'CANCELLED',
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: null,
      stripePriceId: null,
    },
  });

  console.log(`Subscription cancelled for customer ${stripeCustomerId}`);
}

async function handleSubscriptionCreated(stripeSubscription: Stripe.Subscription) {
  const stripeCustomerId = stripeSubscription.customer as string;
  const priceId = stripeSubscription.items.data[0]?.price.id;

  if (!stripeCustomerId || !priceId) {
    console.error('Missing customer or price ID');
    return;
  }

  const planType = getPlanTypeFromStripePriceId(priceId);

  // Check if subscription already exists
  const existingSubscription = await prisma.subscription.findUnique({
    where: { stripeCustomerId },
  });

  if (!existingSubscription) {
    // This shouldn't happen normally, but handle it gracefully
    console.warn('Subscription created without existing record for customer:', stripeCustomerId);
  }

  console.log(`Subscription created for customer ${stripeCustomerId}`);
}
