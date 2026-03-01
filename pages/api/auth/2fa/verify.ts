import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { prisma } from '../../../../lib/prisma';
import speakeasy from 'speakeasy';
import bcrypt from 'bcryptjs';
import { sendBackupCodesEmail } from '../../../../lib/email';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, backupCodes, isSetup = false } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    // For setup flow, we need the session
    if (isSetup) {
      const session = await getSession({ req });
      if (!session?.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = session.user.id;

      // Get user with 2FA secret
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || !user.twoFactorSecret) {
        return res.status(400).json({ 
          error: '2FA setup not initiated',
          code: 'SETUP_NOT_INITIATED'
        });
      }

      // Verify the TOTP code
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: code,
        window: 2, // Allow 2 time steps of drift (±1 minute)
      });

      if (!verified) {
        return res.status(400).json({ 
          error: 'Invalid verification code',
          code: 'INVALID_CODE'
        });
      }

      // Hash backup codes
      const hashedBackupCodes = backupCodes?.map((bc: string) => 
        bcrypt.hashSync(bc, 10)
      ) || [];

      // Enable 2FA
      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
          backupCodes: JSON.stringify(hashedBackupCodes),
        },
      });

      // Send backup codes via email
      try {
        await sendBackupCodesEmail(
          user.email,
          user.name || 'there',
          backupCodes || []
        );
      } catch (emailError) {
        console.error('Failed to send backup codes email:', emailError);
      }

      return res.status(200).json({
        message: 'Two-factor authentication enabled successfully',
        enabled: true,
      });
    }

    // For login flow (verify only, don't enable)
    // This is handled during the sign-in process
    return res.status(400).json({ error: 'Use isSetup=true for initial setup' });

  } catch (error) {
    console.error('2FA verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
