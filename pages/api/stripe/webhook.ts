import type { NextApiRequest, NextApiResponse } from 'next'
import type { Prisma } from '@prisma/client'
import Stripe from 'stripe'
import { prisma } from '../../../lib/prisma'
import { constructWebhookEvent, resolvePricePlan, retrieveInvoiceSnapshot, retrieveSubscriptionSnapshot, type StripeInvoiceSnapshot, type StripeSubscriptionSnapshot } from '../../../lib/stripe'

export const config = { api: { bodyParser: false } }
export const STRIPE_WEBHOOK_MAX_BYTES = 1024 * 1024

class WebhookBodyTooLarge extends Error {}

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const part of req) {
    const chunk = typeof part === 'string' ? Buffer.from(part) : part
    size += chunk.length
    if (size > STRIPE_WEBHOOK_MAX_BYTES) throw new WebhookBodyTooLarge()
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

export function getSubscriptionPeriod(subscription: {
  items?: { data?: Array<{ current_period_start?: number; current_period_end?: number }> }
}): { start: number; end: number } | null {
  const item = subscription.items?.data?.[0]
  if (!item?.current_period_start || !item.current_period_end) return null
  return { start: item.current_period_start, end: item.current_period_end }
}

export function getInvoiceSubscriptionId(invoice: {
  parent?: { type?: string; subscription_details?: { subscription?: string | { id?: string } } | null } | null
}): string | null {
  const subscription = invoice.parent?.subscription_details?.subscription
  return typeof subscription === 'string' ? subscription : subscription?.id || null
}

type WebhookDb = Prisma.TransactionClient

async function auditTransition(db: WebhookDb, userId: string, entityId: string, from: string | null, to: string) {
  if (from === to) return
  await db.auditLog.create({ data: {
    userId, action: 'status_changed', entityType: 'subscription', entityId,
    description: `Subscription status changed from ${from || 'UNKNOWN'} to ${to}`,
    metadata: JSON.stringify({ source: 'stripe_webhook', from, to }),
  } })
}

type EventOrderedSubscription = { stripeLastEventCreated?: number | null; stripeLastEventId?: string | null }

function eventTiming(event: Stripe.Event, subscription: EventOrderedSubscription): 'newer' | 'equal' | 'older' {
  if (subscription.stripeLastEventCreated == null) return 'newer'
  if (event.created > subscription.stripeLastEventCreated) return 'newer'
  if (event.created < subscription.stripeLastEventCreated) return 'older'
  return 'equal'
}

function eventOrder(event: Stripe.Event) {
  return { stripeLastEventCreated: Number.isSafeInteger(event.created) ? event.created : 0, stripeLastEventId: event.id }
}

function snapshotState(snapshot: StripeSubscriptionSnapshot, event: Stripe.Event) {
  const plan = snapshot.priceId ? resolvePricePlan(snapshot.priceId) : null
  if (snapshot.status !== 'CANCELLED' && (!snapshot.priceId || !plan)) throw new Error('Unknown Stripe price')
  return {
    status: snapshot.status,
    ...(snapshot.priceId ? { stripePriceId: snapshot.priceId } : {}),
    ...(plan ? { plan } : {}),
    currentPeriodStart: snapshot.currentPeriodStart ? new Date(snapshot.currentPeriodStart * 1000) : null,
    currentPeriodEnd: snapshot.currentPeriodEnd ? new Date(snapshot.currentPeriodEnd * 1000) : null,
    cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
    ...eventOrder(event),
  }
}

async function syncInvoice(db: WebhookDb, event: Stripe.Event, subscriptionSnapshot: StripeSubscriptionSnapshot, invoice: Stripe.Invoice, invoiceSnapshot: StripeInvoiceSnapshot) {
  const stripeSubscriptionId = getInvoiceSubscriptionId(invoice)
  if (!stripeSubscriptionId) return
  const local = await db.subscription.findUnique({ where: { stripeSubscriptionId } })
  if (!local) return
  const amount = invoiceSnapshot.status === 'paid' ? invoiceSnapshot.amountPaid : invoiceSnapshot.amountDue
  const presentationStatus = event.type === 'invoice.payment_failed' && invoiceSnapshot.status === 'open'
    ? 'failed'
    : invoiceSnapshot.status
  await db.invoice.upsert({
    where: { stripeInvoiceId: invoiceSnapshot.id },
    update: {
      amount,
      currency: invoiceSnapshot.currency.toUpperCase(), status: presentationStatus, invoicePdf: invoiceSnapshot.invoicePdf,
      periodStart: new Date(invoiceSnapshot.periodStart * 1000), periodEnd: new Date(invoiceSnapshot.periodEnd * 1000),
    },
    create: {
      userId: local.userId, stripeInvoiceId: invoiceSnapshot.id,
      amount,
      currency: invoiceSnapshot.currency.toUpperCase(), status: presentationStatus, invoicePdf: invoiceSnapshot.invoicePdf,
      periodStart: new Date(invoiceSnapshot.periodStart * 1000), periodEnd: new Date(invoiceSnapshot.periodEnd * 1000),
    },
  })
  if (eventTiming(event, local) === 'older') return
  const data = snapshotState(subscriptionSnapshot, event)
  await db.subscription.update({ where: { stripeSubscriptionId }, data })
  await auditTransition(db, local.userId, local.id, local.status, subscriptionSnapshot.status)
}

async function processEvent(db: WebhookDb, event: Stripe.Event, snapshot: StripeSubscriptionSnapshot | null, invoiceSnapshot: StripeInvoiceSnapshot | null) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId
      if (!userId || !session.subscription || !session.customer || !snapshot) throw new Error('Invalid checkout mapping')
      const previous = await db.subscription.findUnique({ where: { userId } })
      if (previous && eventTiming(event, previous) === 'older') break
      const data = snapshotState(snapshot, event)
      const record = await db.subscription.upsert({
        where: { userId },
        update: { stripeSubscriptionId: String(session.subscription), stripeCustomerId: String(session.customer), ...data },
        create: { userId, stripeSubscriptionId: String(session.subscription), stripeCustomerId: String(session.customer), plan: 'UNLIMITED', ...data },
      })
      await auditTransition(db, userId, record.id, previous?.status || null, snapshot.status)
      break
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      if (!snapshot) throw new Error('Missing Stripe subscription state')
      const local = await db.subscription.findUnique({ where: { stripeSubscriptionId: subscription.id } })
      if (!local || eventTiming(event, local) === 'older') break
      await db.subscription.update({ where: { stripeSubscriptionId: subscription.id }, data: snapshotState(snapshot, event) })
      await auditTransition(db, local.userId, local.id, local.status, snapshot.status)
      break
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const local = await db.subscription.findUnique({ where: { stripeSubscriptionId: subscription.id } })
      if (!local || !snapshot || eventTiming(event, local) === 'older') break
      await db.subscription.update({ where: { stripeSubscriptionId: subscription.id }, data: snapshotState(snapshot, event) })
      await auditTransition(db, local.userId, local.id, local.status, snapshot.status)
      break
    }
    case 'invoice.payment_failed':
      if (!snapshot || !invoiceSnapshot) throw new Error('Missing Stripe reconciliation state')
      await syncInvoice(db, event, snapshot, event.data.object as Stripe.Invoice, invoiceSnapshot)
      break
    case 'invoice.paid':
    case 'invoice.payment_succeeded':
      if (!snapshot || !invoiceSnapshot) throw new Error('Missing Stripe reconciliation state')
      await syncInvoice(db, event, snapshot, event.data.object as Stripe.Invoice, invoiceSnapshot)
      break
  }
}

export function isDuplicateWebhookEvent(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 'P2002' || !('meta' in error)) return false
  const meta = error.meta
  if (typeof meta !== 'object' || meta === null) return false
  const modelName = 'modelName' in meta ? meta.modelName : null
  const target = 'target' in meta ? meta.target : null
  const normalizedTarget = Array.isArray(target) ? target.join('.') : typeof target === 'string' ? target : ''
  if (modelName === 'StripeWebhookEvent') return /(^|[._])id$|StripeWebhookEvent_pkey$/i.test(normalizedTarget)
  if (modelName != null) return false
  return /^(?:id|StripeWebhookEvent_pkey|(?:public\.)?StripeWebhookEvent[._].*id)$/i.test(normalizedTarget)
}

class DuplicateWebhookDelivery extends Error {}

function eventSubscriptionId(event: Stripe.Event): string | null {
  switch (event.type) {
    case 'checkout.session.completed': {
      const value = (event.data.object as Stripe.Checkout.Session).subscription
      return typeof value === 'string' ? value : value?.id || null
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return (event.data.object as Stripe.Subscription).id
    case 'invoice.payment_failed':
    case 'invoice.paid':
    case 'invoice.payment_succeeded':
      return getInvoiceSubscriptionId(event.data.object as Stripe.Invoice)
    default:
      return null
  }
}

function eventInvoiceId(event: Stripe.Event): string | null {
  return event.type === 'invoice.payment_failed' || event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded'
    ? (event.data.object as Stripe.Invoice).id
    : null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }) }
  const signature = req.headers['stripe-signature']
  if (!signature || typeof signature !== 'string') return res.status(400).json({ error: 'Missing stripe-signature header' })

  const contentLengthHeader = Array.isArray(req.headers['content-length'])
    ? req.headers['content-length'][0]
    : req.headers['content-length']
  const declaredLength = Number(contentLengthHeader)
  if (Number.isFinite(declaredLength) && declaredLength > STRIPE_WEBHOOK_MAX_BYTES) {
    return res.status(413).json({ error: 'Webhook payload is too large' })
  }

  let rawBody: Buffer
  try {
    rawBody = await getRawBody(req)
  } catch (error) {
    if (error instanceof WebhookBodyTooLarge) {
      return res.status(413).json({ error: 'Webhook payload is too large' })
    }
    return res.status(400).json({ error: 'Webhook payload is invalid' })
  }

  let event: Stripe.Event
  try {
    event = constructWebhookEvent(rawBody, signature)
  } catch {
    console.error('Stripe webhook signature verification failed')
    return res.status(400).json({ error: 'Webhook signature verification failed' })
  }

  try {
    const processed = await prisma.stripeWebhookEvent.findUnique({ where: { id: event.id }, select: { id: true } })
    if (processed) return res.status(200).json({ received: true, duplicate: true })
  } catch {
    console.error(`Stripe webhook idempotency preflight failed for ${event.id || 'unknown'} (${event.type})`)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }

  let snapshot: StripeSubscriptionSnapshot | null = null
  let invoiceSnapshot: StripeInvoiceSnapshot | null = null
  const subscriptionId = eventSubscriptionId(event)
  const invoiceId = eventInvoiceId(event)
  if (subscriptionId || invoiceId) {
    try {
      const [subscriptionResult, invoiceResult] = await Promise.all([
        subscriptionId ? retrieveSubscriptionSnapshot(subscriptionId) : Promise.resolve(null),
        invoiceId ? retrieveInvoiceSnapshot(invoiceId) : Promise.resolve(null),
      ])
      snapshot = subscriptionResult
      invoiceSnapshot = invoiceResult
    } catch {
      console.error(`Stripe billing reconciliation failed for ${event.id || 'unknown'} (${event.type})`)
      return res.status(500).json({ error: 'Webhook processing failed' })
    }
  }

  try {
    await prisma.$transaction(async (db) => {
      try {
        await db.stripeWebhookEvent.create({ data: { id: event.id, type: event.type } })
      } catch (error) {
        // This classifier is deliberately scoped to the marker insert. A
        // model-less PostgreSQL `id` target is safe here but ambiguous after it.
        if (isDuplicateWebhookEvent(error)) throw new DuplicateWebhookDelivery()
        throw error
      }
      await processEvent(db, event, snapshot, invoiceSnapshot)
    }, { isolationLevel: 'Serializable' })
  } catch (error) {
    if (error instanceof DuplicateWebhookDelivery) return res.status(200).json({ received: true, duplicate: true })
    console.error(`Stripe webhook processing failed for ${event.id || 'unknown'} (${event.type})`)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }
  return res.status(200).json({ received: true })
}
