import { NextApiRequest, NextApiResponse } from 'next';
import { getUserFromRequest } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { decryptSecret } from '../../../../lib/cryptoSecrets';
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

    if (isSetup) {
      const session = await getUserFromRequest(req);
      if (!session?.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = session.user.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || !user.twoFactorSecret) {
        return res.status(400).json({
          error: '2FA setup not initiated',
          code: 'SETUP_NOT_INITIATED',
        });
      }

      const plaintextSecret = decryptSecret(user.twoFactorSecret);

      const verified = speakeasy.totp.verify({
        secret: plaintextSecret,
        encoding: 'base32',
        token: code,
        window: 2,
      });

      if (!verified) {
        return res.status(400).json({
          error: 'Invalid verification code',
          code: 'INVALID_CODE',
        });
      }

      const hashedBackupCodes =
        backupCodes?.map((bc: string) => bcrypt.hashSync(bc, 10)) || [];

      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
          backupCodes: JSON.stringify(hashedBackupCodes),
        },
      });

      try {
        await sendBackupCodesEmail(
          user.email,
          user.name || 'there',
          backupCodes || []
        );
      } catch (emailError) {
        console.error('Failed to send backup codes email:', emailError);
      }

      // Do not return the TOTP secret again after enablement
      return res.status(200).json({
        message: 'Two-factor authentication enabled successfully',
        enabled: true,
      });
    }

    return res.status(400).json({ error: 'Use isSetup=true for initial setup' });
  } catch (error) {
    console.error('2FA verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
