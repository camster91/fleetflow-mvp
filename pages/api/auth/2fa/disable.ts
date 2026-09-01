import { NextApiRequest, NextApiResponse } from 'next';
import { getUserFromRequest } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { decryptSecret } from '../../../../lib/cryptoSecrets';
import speakeasy from 'speakeasy';
import bcrypt from 'bcryptjs';
import { assertSameOrigin } from '../../../../lib/apiAuth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!assertSameOrigin(req, res)) return;

  try {
    const session = await getUserFromRequest(req);
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: '2FA code is required' });
    }

    const userId = session.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({
        error: 'Two-factor authentication is not enabled',
        code: '2FA_NOT_ENABLED'
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
      const storedBackupCodes = user.backupCodes;
      const backupCodes = storedBackupCodes ? JSON.parse(storedBackupCodes) : [];

      let usedBackupCodeIndex = -1;

      for (let i = 0; i < backupCodes.length; i++) {
        if (bcrypt.compareSync(code, backupCodes[i])) {
          usedBackupCodeIndex = i;
          break;
        }
      }

      if (usedBackupCodeIndex < 0 || !storedBackupCodes) {
        return res.status(400).json({
          error: 'Invalid verification code',
          code: 'INVALID_CODE'
        });
      }

      backupCodes.splice(usedBackupCodeIndex, 1);
      const consumed = await prisma.user.updateMany({
        where: {
          id: userId,
          backupCodes: storedBackupCodes,
          twoFactorEnabled: true,
        },
        data: {
          backupCodes: JSON.stringify(backupCodes),
        },
      });

      if (consumed.count !== 1) {
        return res.status(400).json({
          error: 'Invalid verification code',
          code: 'INVALID_CODE'
        });
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        backupCodes: null,
      },
    });

    return res.status(200).json({
      message: 'Two-factor authentication disabled successfully',
      enabled: false,
    });
  } catch (error) {
    console.error('2FA disable error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
