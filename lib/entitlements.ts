/**
 * Plan entitlements: whether a workspace may change data, derived from its owner's subscription.
 *
 * Policy (#150):
 * - A workspace without a paid subscription gets a 14-day trial from the owner's sign-up, or until
 *   FLEETVERA_BETA_ENDS_AT if that is later (beta workspaces are grandfathered to the announced date).
 * - A failed payment keeps full access for 7 days while Stripe retries, then the workspace is read-only.
 * - A cancelled subscription keeps full access until the end of the paid period, then is read-only.
 * - Read-only never blocks viewing, exports, billing, settings, team management or sign-in; it blocks
 *   business writes with 402 SUBSCRIPTION_REQUIRED. Drivers may still update deliveries assigned to them.
 *
 * Enforcement is off unless FLEETVERA_RELEASE_MODE=public and Stripe checkout is configured, so the
 * free beta (pilot mode) and any deployment where nobody can pay keep full access.
 */
import type { NextApiRequest } from 'next'
import { prisma } from './prisma'
import { getBillingAvailability } from './stripe'
import type { TeamRole } from '../types'

export const TRIAL_DAYS = 14
export const PAST_DUE_GRACE_DAYS = 7
const DAY_MS = 86_400_000

export type EntitlementReason =
  | 'NOT_ENFORCED'
  | 'TRIAL'
  | 'ACTIVE'
  | 'CANCELLING'
  | 'PAYMENT_GRACE'
  | 'TRIAL_EXPIRED'
  | 'PAYMENT_OVERDUE'
  | 'CANCELLED'

export interface Entitlement {
  enforced: boolean
  access: 'FULL' | 'READ_ONLY'
  reason: EntitlementReason
  /** Trial end for workspaces without a paid subscription. */
  trialEndsAt: Date | null
  /** When a failed payment stops being tolerated. */
  graceEndsAt: Date | null
  /** When a cancelled subscription's paid period ends. */
  accessEndsAt: Date | null
  /** When the workspace became read-only. */
  readOnlySince: Date | null
}

export interface SubscriptionFacts {
  status: string
  stripeSubscriptionId: string | null
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  pastDueSince: Date | null
  updatedAt: Date
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** API areas that stay writable while read-only: billing, settings, team, integrations admin, sign-in. */
const READ_ONLY_EXEMPT_PREFIXES = [
  '/api/stripe/',
  '/api/subscription/',
  '/api/settings/',
  '/api/team/',
  '/api/admin/',
  '/api/integrations/',
  '/api/auth/',
  '/api/pilot/',
  // Asking the assistant a question reads data; it does not change it.
  '/api/assistant/',
  '/api/ai/',
]
const DRIVER_STATUS_PATH = /^\/api\/deliveries\/[^/]+\/status\/?$/

export function billingEnforced(): boolean {
  return process.env.FLEETVERA_RELEASE_MODE === 'public' && getBillingAvailability().available
}

/** Parse FLEETVERA_BETA_ENDS_AT; an unset or invalid value grants no extra trial. */
export function betaEndsAt(env: Record<string, string | undefined> = process.env): Date | null {
  const raw = env.FLEETVERA_BETA_ENDS_AT?.trim()
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS)

const base = { enforced: true, trialEndsAt: null, graceEndsAt: null, accessEndsAt: null, readOnlySince: null }

/** Pure policy: the workspace's access at `now`. */
export function computeEntitlement(
  subscription: SubscriptionFacts | null,
  ownerCreatedAt: Date,
  now: Date,
  beta: Date | null = null
): Entitlement {
  if (subscription?.stripeSubscriptionId) {
    switch (subscription.status) {
      case 'ACTIVE':
      case 'TRIAL':
        return subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd
          ? { ...base, access: 'FULL', reason: 'CANCELLING', accessEndsAt: subscription.currentPeriodEnd }
          : { ...base, access: 'FULL', reason: 'ACTIVE' }
      case 'PAST_DUE':
      case 'UNPAID': {
        const since = subscription.pastDueSince ?? subscription.currentPeriodStart ?? subscription.updatedAt
        const graceEndsAt = addDays(since, PAST_DUE_GRACE_DAYS)
        // Stripe marks a subscription UNPAID once it stops retrying, which ends any grace early.
        if (subscription.status === 'PAST_DUE' && now < graceEndsAt)
          return { ...base, access: 'FULL', reason: 'PAYMENT_GRACE', graceEndsAt }
        return {
          ...base,
          access: 'READ_ONLY',
          reason: 'PAYMENT_OVERDUE',
          graceEndsAt,
          readOnlySince: graceEndsAt <= now ? graceEndsAt : subscription.updatedAt,
        }
      }
      case 'CANCELLED': {
        const end = subscription.currentPeriodEnd
        if (end && now < end) return { ...base, access: 'FULL', reason: 'CANCELLING', accessEndsAt: end }
        return {
          ...base,
          access: 'READ_ONLY',
          reason: 'CANCELLED',
          accessEndsAt: end,
          readOnlySince: end ?? subscription.updatedAt,
        }
      }
    }
  }

  // No paid subscription (never subscribed, or only a checkout placeholder): the app-side trial.
  const standardTrialEnd = addDays(ownerCreatedAt, TRIAL_DAYS)
  const trialEndsAt = beta && beta > standardTrialEnd ? beta : standardTrialEnd
  return now < trialEndsAt
    ? { ...base, access: 'FULL', reason: 'TRIAL', trialEndsAt }
    : { ...base, access: 'READ_ONLY', reason: 'TRIAL_EXPIRED', trialEndsAt, readOnlySince: trialEndsAt }
}

export const NOT_ENFORCED: Entitlement = {
  enforced: false,
  access: 'FULL',
  reason: 'NOT_ENFORCED',
  trialEndsAt: null,
  graceEndsAt: null,
  accessEndsAt: null,
  readOnlySince: null,
}

/** Load the workspace owner's subscription and evaluate it. Team members inherit the owner's state. */
export async function getWorkspaceEntitlement(ownerId: string, now = new Date()): Promise<Entitlement> {
  if (!billingEnforced()) return NOT_ENFORCED
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: {
      createdAt: true,
      subscription: {
        select: {
          status: true,
          stripeSubscriptionId: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          pastDueSince: true,
          updatedAt: true,
        },
      },
    },
  })
  // A missing owner cannot be billed; fail open rather than lock the workspace on a data error.
  if (!owner) return NOT_ENFORCED
  return computeEntitlement(owner.subscription, owner.createdAt, now, betaEndsAt())
}

function requestPath(req: NextApiRequest): string {
  try {
    return new URL(req.url || '/', 'http://localhost').pathname
  } catch {
    return req.url || ''
  }
}

/** Whether this request must pass the read-only check at all. */
export function isWriteSubjectToEntitlement(req: NextApiRequest, role: TeamRole): boolean {
  if (!MUTATING_METHODS.has((req.method || 'GET').toUpperCase())) return false
  const path = requestPath(req)
  if (READ_ONLY_EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix))) return false
  // Never strand a truck mid-route: drivers can keep updating deliveries assigned to them.
  if (role === 'DRIVER' && DRIVER_STATUS_PATH.test(path)) return false
  return true
}

export const READ_ONLY_MESSAGE =
  'This workspace is read-only until its subscription is active. You can still view and export your data.'

export function serializeEntitlement(entitlement: Entitlement) {
  const iso = (value: Date | null) => value?.toISOString() ?? null
  return {
    enforced: entitlement.enforced,
    access: entitlement.access,
    reason: entitlement.reason,
    trialEndsAt: iso(entitlement.trialEndsAt),
    graceEndsAt: iso(entitlement.graceEndsAt),
    accessEndsAt: iso(entitlement.accessEndsAt),
    readOnlySince: iso(entitlement.readOnlySince),
  }
}
