import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { randomBytes } from 'crypto';

// Generate a secure API key
function generateApiKey(): string {
  return 'ff_live_' + randomBytes(24).toString('hex');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  switch (req.method) {
    case 'GET':
      try {
        const keys = await prisma.apiKey.findMany({
          where: {
            userId,
            revokedAt: null,
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            key: true,
            createdAt: true,
            lastUsedAt: true,
          },
        });

        // Mask keys except for the last 4 characters
        const maskedKeys = keys.map(k => ({
          ...k,
          key: k.key.substring(0, 12) + '••••••••' + k.key.slice(-4),
        }));

        return res.status(200).json({ keys: maskedKeys });
      } catch (error) {
        console.error('Failed to fetch API keys:', error);
        return res.status(500).json({ error: 'Failed to fetch API keys' });
      }

    case 'POST':
      try {
        const { name } = req.body;

        if (!name) {
          return res.status(400).json({ error: 'Name is required' });
        }

        const key = generateApiKey();

        const apiKey = await prisma.apiKey.create({
          data: {
            userId,
            name,
            key,
          },
          select: {
            id: true,
            name: true,
            key: true,
            createdAt: true,
          },
        });

        return res.status(201).json({ apiKey });
      } catch (error) {
        console.error('Failed to create API key:', error);
        return res.status(500).json({ error: 'Failed to create API key' });
      }

    case 'DELETE':
      try {
        const { id } = req.query;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'API key ID is required' });
        }

        await prisma.apiKey.updateMany({
          where: {
            id,
            userId,
          },
          data: {
            revokedAt: new Date(),
          },
        });

        return res.status(200).json({ success: true });
      } catch (error) {
        console.error('Failed to revoke API key:', error);
        return res.status(500).json({ error: 'Failed to revoke API key' });
      }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
