import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { constructWebhookEvent } from '../../../lib/stripe';
import Stripe from 'stripe';

// Disable Next.js body parser — Stripe needs the raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export function getSubscriptionPeriod(subscription: {
  items?: { data?: Array<{ current_period_start?: number; current_period_end?: number }> };
}): { start: number; end: number } | null {
  const item = subscription.items?.data?.[0];
  if (!item?.current_period_start || !item.current_period_end) return null;
  return { start: item.current_period_start, end: item.current_period_end };
}

export function getInvoiceSubscriptionId(invoice: {
  parent?: {
    type?: string;
    subscription_details?: { subscription?: string | { id?: string } } | null;
  } | null;
}): string | null {
  const subscription = invoice.parent?.subscription_details?.subscription;
  if (typeof subscription === 'string') return subscription;
  return subscription?.id || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature || typeof signature !== 'string') {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await getRawBody(req);
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (userId && session.subscription) {
          await prisma.subscription.upsert({
            where: { userId },
            update: {
              stripeSubscriptionId: session.subscription as string,
              stripeCustomerId: session.customer as string,
              status: 'ACTIVE',
            },
            create: {
              userId,
              stripeSubscriptionId: session.subscription as string,
              stripeCustomerId: session.customer as string,
              status: 'ACTIVE',
              plan: 'UNLIMITED',
            },
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const period = getSubscriptionPeriod(subscription);
        const subRecord = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: subscription.id },
        });
        if (subRecord) {
          const statusMap: Record<string, string> = {
            active: 'ACTIVE',
            past_due: 'PAST_DUE',
            canceled: 'CANCELLED',
            unpaid: 'UNPAID',
            trialing: 'TRIAL',
          };
          await prisma.subscription.update({
            where: { stripeSubscriptionId: subscription.id },
            data: {
              status: statusMap[subscription.status] || 'ACTIVE',
              currentPeriodStart: period ? new Date(period.start * 1000) : undefined,
              currentPeriodEnd: period ? new Date(period.end * 1000) : undefined,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              stripePriceId: subscription.items.data[0]?.price?.id || null,
            },
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const subRecord = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: subscription.id },
        });
        if (subRecord) {
          await prisma.subscription.update({
            where: { stripeSubscriptionId: subscription.id },
            data: { status: 'CANCELLED', cancelAtPeriodEnd: false },
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = getInvoiceSubscriptionId(invoice);
        if (subscriptionId) {
          const subRecord = await prisma.subscription.findUnique({
            where: { stripeSubscriptionId: subscriptionId },
          });
          if (subRecord) {
            await prisma.subscription.update({
              where: { stripeSubscriptionId: subscriptionId },
              data: { status: 'PAST_DUE' },
            });
          }
        }
        break;
      }
    }
  } catch (error) {
    console.error('Webhook handler error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  // Always return 200 for all events
  return res.status(200).json({ received: true });
}
