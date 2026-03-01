import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import speakeasy from 'speakeasy';
import bcrypt from 'bcryptjs';
import { rateLimitMiddleware } from '../../../../lib/rateLimit';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Apply rate limiting
  const allowed = await rateLimitMiddleware(req, res, 'twoFactor');
  if (!allowed) return;

  try {
    const { userId, code, rememberDevice = false } = req.body;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: '2FA code is required' });
    }

    // Get user with 2FA secret
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

    // Verify the TOTP code
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    let isBackupCode = false;
    
    if (!verified) {
      // Check if it's a backup code
      const backupCodes = user.backupCodes ? JSON.parse(user.backupCodes) : [];
      
      let backupCodeValid = false;
      let usedBackupCodeIndex = -1;
      
      for (let i = 0; i < backupCodes.length; i++) {
        if (bcrypt.compareSync(code, backupCodes[i])) {
          backupCodeValid = true;
          usedBackupCodeIndex = i;
          isBackupCode = true;
          break;
        }
      }

      if (!backupCodeValid) {
        return res.status(400).json({ 
          error: 'Invalid verification code',
          code: 'INVALID_CODE'
        });
      }

      // Remove used backup code
      if (usedBackupCodeIndex >= 0) {
        backupCodes.splice(usedBackupCodeIndex, 1);
        await prisma.user.update({
          where: { id: userId },
          data: {
            backupCodes: JSON.stringify(backupCodes),
          },
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
