import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { cancelSubscription } from '../../../lib/stripe';
import { assertSameOrigin, requireTenantContext } from '../../../lib/apiAuth';
import { canManageBilling } from '../../../lib/permissions';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const context = await requireTenantContext(req, res);
  if (!context) return;
  if (!canManageBilling(context.tenant.role)) return res.status(403).json({ error: 'Forbidden' });
  if (!assertSameOrigin(req, res)) return;

  const subscription = await prisma.subscription.findUnique({
    where: { userId: context.tenant.ownerId },
  });

  if (!subscription?.stripeSubscriptionId) {
    return res.status(400).json({ error: 'No active subscription to cancel' });
  }

  try {
    await cancelSubscription(subscription.stripeSubscriptionId, true);

    await prisma.$transaction(async tx => {
      await tx.subscription.update({
        where: { userId: context.tenant.ownerId },
        data: { cancelAtPeriodEnd: true },
      });
      await tx.auditLog.create({ data: {
        userId: context.session.user.id,
        teamId: context.tenant.teamId,
        userName: context.session.user.name || null,
        userRole: context.tenant.role,
        action: 'updated',
        entityType: 'subscription',
        entityId: subscription.id,
        description: 'Subscription cancellation scheduled for period end',
        metadata: JSON.stringify({ cancelAtPeriodEnd: true }),
      } });
    });

    return res.status(200).json({ message: 'Subscription will cancel at period end' });
  } catch {
    console.error('Stripe subscription cancellation failed');
    return res.status(500).json({ error: 'Failed to cancel subscription' });
  }
}
