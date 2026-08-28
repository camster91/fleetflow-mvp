import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { decryptSecret } from '../../../../lib/cryptoSecrets';
import speakeasy from 'speakeasy';
import bcrypt from 'bcryptjs';
import { rateLimitMiddleware } from '../../../../lib/rateLimit';
import { parse } from 'cookie';
import { signToken, verifyToken } from '../../../../lib/auth';
import { assertSameOrigin } from '../../../../lib/apiAuth';
import { establishSessionCookies } from '../../../../lib/authCookies';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'private, no-store');
  if (!assertSameOrigin(req, res)) return;

  // Apply rate limiting
  const allowed = await rateLimitMiddleware(req, res, 'twoFactor');
  if (!allowed) return;

  try {
    const { code, rememberDevice = false } = req.body;

    const challengeToken = parse(req.headers.cookie || '').two_factor_challenge;
    const challenge = challengeToken ? verifyToken(challengeToken) : null;
    if (!challenge?.sub || challenge.purpose !== 'two-factor') {
      return res.status(401).json({ error: 'Two-factor challenge expired or invalid' });
    }
    const userId = challenge.sub;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: '2FA code is required' });
    }

    // Get user with 2FA secret
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(401).json({ error: 'Two-factor challenge expired or invalid' });
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

    let isBackupCode = false;
    
    if (!verified) {
      const storedBackupCodes = user.backupCodes;
      const backupCodes = storedBackupCodes ? JSON.parse(storedBackupCodes) : [];

      let usedBackupCodeIndex = -1;

      for (let i = 0; i < backupCodes.length; i++) {
        if (bcrypt.compareSync(code, backupCodes[i])) {
          usedBackupCodeIndex = i;
          isBackupCode = true;
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

    // Update last login time
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    const sessionToken = signToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      purpose: 'session',
    });
    res.setHeader('Set-Cookie', establishSessionCookies(sessionToken));

    return res.status(200).json({
      message: '2FA verification successful',
      valid: true,
      isBackupCode,
      rememberDevice,
    });
  } catch (error) {
    console.error('2FA validation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
