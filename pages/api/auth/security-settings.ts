import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { prisma } from '../../../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check authentication
    const session = await getSession({ req });
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = session.user.id;

    // Get user with security info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorEnabled: true,
        lastLoginAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get recent login history
    const loginHistory = await prisma.loginHistory.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    return res.status(200).json({
      twoFactorEnabled: user.twoFactorEnabled,
      lastPasswordChange: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      loginHistory: loginHistory.map((record: { id: string; timestamp: Date; ipAddress: string | null; userAgent: string | null; success: boolean }) => ({
        id: record.id,
        timestamp: record.timestamp,
        ipAddress: record.ipAddress,
        userAgent: record.userAgent,
        success: record.success,
      })),
    });
  } catch (error) {
    console.error('Security settings error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
