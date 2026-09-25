import { NextApiRequest, NextApiResponse } from 'next';
import { getUserFromRequest, signToken } from '../../../../lib/auth';
import { sessionCookie } from '../../../../lib/authCookies';
import { prisma } from '../../../../lib/prisma';
import { decryptSecret } from '../../../../lib/cryptoSecrets';
import { assertSameOrigin } from '../../../../lib/apiAuth';
import speakeasy from 'speakeasy';
import bcrypt from 'bcryptjs';
import { sendBackupCodesEmail } from '../../../../lib/email';

const BACKUP_CODE_PATTERN = /^\d{4}-\d{4}-\d{4}$/;
const TOTP_STEP_SECONDS = 30;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!assertSameOrigin(req, res)) return;

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

      if (!user || !user.twoFactorSecret || !user.backupCodes) {
        return res.status(400).json({
          error: '2FA setup not initiated',
          code: 'SETUP_NOT_INITIATED',
        });
      }

      if (
        !Array.isArray(backupCodes) ||
        backupCodes.length !== 10 ||
        !backupCodes.every(
          (backupCode: unknown) =>
            typeof backupCode === 'string' && BACKUP_CODE_PATTERN.test(backupCode)
        )
      ) {
        return res.status(400).json({
          error: '2FA setup data is invalid or stale',
          code: 'SETUP_CHANGED',
        });
      }

      const storedBackupCodes = JSON.parse(user.backupCodes);
      if (
        !Array.isArray(storedBackupCodes) ||
        storedBackupCodes.length !== backupCodes.length ||
        !backupCodes.every((backupCode: string, index: number) =>
          typeof storedBackupCodes[index] === 'string' &&
          bcrypt.compareSync(backupCode, storedBackupCodes[index])
        )
      ) {
        return res.status(400).json({
          error: '2FA setup data is invalid or stale',
          code: 'SETUP_CHANGED',
        });
      }

      const plaintextSecret = decryptSecret(user.twoFactorSecret);

      const nowSeconds = Date.now() / 1000;
      const match = speakeasy.totp.verifyDelta({
        secret: plaintextSecret,
        encoding: 'base32',
        token: code,
        window: 2,
        time: nowSeconds,
      });

      if (!match) {
        return res.status(400).json({
          error: 'Invalid verification code',
          code: 'INVALID_CODE',
        });
      }

      const enabled = await prisma.user.updateMany({
        where: {
          id: userId,
          twoFactorEnabled: false,
          twoFactorSecret: user.twoFactorSecret,
          backupCodes: user.backupCodes,
        },
        data: {
          twoFactorEnabled: true,
          // Record the setup code's time step so /api/auth/2fa/validate
          // cannot accept the same code again (same rule as validate.ts).
          lastTotpStep: Math.floor(nowSeconds / TOTP_STEP_SECONDS) + match.delta,
          // Revoke every other session issued before 2FA was turned on.
          tokenVersion: { increment: 1 },
        },
      });

      if (enabled.count !== 1) {
        return res.status(409).json({
          error: '2FA setup changed; start setup again',
          code: 'SETUP_CHANGED',
        });
      }

      // Keep this browser signed in with a token for the new version.
      res.setHeader('Set-Cookie', sessionCookie(await signToken({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tv: (user.tokenVersion ?? 0) + 1,
      })));

      try {
        await sendBackupCodesEmail(
          user.email,
          user.name || 'there',
          backupCodes
        );
      } catch (emailError) {
        console.error('Failed to send backup codes email:', emailError);
      }

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
