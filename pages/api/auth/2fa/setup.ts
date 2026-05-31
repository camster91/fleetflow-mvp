import { NextApiRequest, NextApiResponse } from 'next';
import { getUserFromRequest } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check authentication
    const session = await getUserFromRequest(req);
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = session.user.id;

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if 2FA is already enabled
    if (user.twoFactorEnabled) {
      return res.status(400).json({ 
        error: 'Two-factor authentication is already enabled',
        code: '2FA_ALREADY_ENABLED'
      });
    }

    // Generate 2FA secret
    const secret = speakeasy.generateSecret({
      name: `FleetFlow:${user.email}`,
      issuer: process.env.TWO_FACTOR_ISSUER || 'Fleet Manager',
      length: 32,
    });

    // Store the secret temporarily (not enabled until verified)
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret.base32,
      },
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');

    // Generate backup codes using cryptographically secure randomness
    const backupCodes = Array.from({ length: 10 }, () => {
      const bytes = require('crypto').randomBytes(4);
      return bytes.toString('hex').substring(0, 6).toUpperCase();
    });

    return res.status(200).json({
      message: '2FA setup initiated',
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32,
      backupCodes, // Send plain backup codes to user (they won't be retrievable again)
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
