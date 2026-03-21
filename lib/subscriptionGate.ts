import { prisma } from './prisma';
import { hasActiveSubscription, hasTrialExpired } from './subscription';
import type { Subscription } from './subscription';

/**
 * Check if a user has an active subscription (including valid trial).
 * Returns true if user can access gated features.
 */
export async function isSubscriptionActive(userId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription) return false;

  // Cast Prisma record to our Subscription type
  const sub = subscription as unknown as Subscription;

  if (hasTrialExpired(sub)) return false;

  return hasActiveSubscription(sub);
}

/**
 * Higher-order function to gate an API handler behind an active subscription.
 */
export function withSubscriptionGate(
  handler: (req: any, res: any) => Promise<void>
) {
  return async (req: any, res: any) => {
    const { getServerSession } = await import('next-auth/next');
    const { authOptions } = await import('./auth');

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const active = await isSubscriptionActive(session.user.id);
    if (!active) {
      return res.status(403).json({ error: 'Active subscription required' });
    }

    return handler(req, res);
  };
}
