import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { decryptSecret } from '../../../../lib/cryptoSecrets';
import speakeasy from 'speakeasy';
import bcrypt from 'bcryptjs';
import { rateLimitMiddleware } from '../../../../lib/rateLimit';
import { parse } from 'cookie';
import { signToken, tokenVersionOf, verifyToken } from '../../../../lib/auth';
import { isAccountLocked, notLockedWhere, recordFailedAttempt } from '../../../../lib/loginLockout';
import { assertSameOrigin } from '../../../../lib/apiAuth';
import { establishSessionCookies } from '../../../../lib/authCookies';

const TOTP_CODE_PATTERN = /^\d{6}$/;
// Matches generateBackupCodes() in lib/tokens.ts (XXXX-XXXX-XXXX digits).
const BACKUP_CODE_PATTERN = /^\d{4}-\d{4}-\d{4}$/;
const TOTP_STEP_SECONDS = 30;

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

  try {
    const { code, rememberDevice = false } = req.body;

    const challengeToken = parse(req.headers.cookie || '').two_factor_challenge;
    const challenge = challengeToken ? verifyToken(challengeToken) : null;
    if (!challenge?.sub || challenge.purpose !== 'two-factor') {
      return res.status(401).json({ error: 'Two-factor challenge expired or invalid' });
    }
    const userId = challenge.sub;

    // Limit per challenge subject, not per IP: rotating X-Forwarded-For must
    // not buy an attacker holding one challenge more guesses.
    const allowed = await rateLimitMiddleware(req, res, 'twoFactor', `user:${userId}`);
    if (!allowed) return;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: '2FA code is required' });
    }
    const input = code.trim();

    // Get user with 2FA secret
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || tokenVersionOf(challenge) !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ error: 'Two-factor challenge expired or invalid' });
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ 
        error: 'Two-factor authentication is not enabled',
        code: '2FA_NOT_ENABLED'
      });
    }

    if (isAccountLocked(user)) {
      return res.status(423).json({ error: 'Account temporarily locked. Try again later.' });
    }

    // Wrong 2FA codes count toward the same lockout as wrong login codes. The
    // counter is incremented in the database, never written from the snapshot.
    const rejectInvalidCode = async () => {
      await recordFailedAttempt(prisma, userId);
      return res.status(400).json({
        error: 'Invalid verification code',
        code: 'INVALID_CODE'
      });
    };

    // Success writes only land while the account is unlocked and the challenge's
    // token version is current (a concurrent lock bumps it), so a stale request
    // can never clear a lock set after the snapshot above.
    const successGuard = {
      id: userId,
      twoFactorEnabled: true,
      tokenVersion: user.tokenVersion ?? 0,
      ...notLockedWhere(),
    };
    const successfulLogin = {
      lastLoginAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    };

    let isBackupCode = false;

    if (TOTP_CODE_PATTERN.test(input)) {
      const nowSeconds = Date.now() / 1000;
      const match = speakeasy.totp.verifyDelta({
        secret: decryptSecret(user.twoFactorSecret),
        encoding: 'base32',
        token: input,
        window: 2,
        time: nowSeconds,
      });
      if (!match) return rejectInvalidCode();

      // Accept each TOTP time step at most once, and never one older than the
      // last accepted step. The conditional update makes this atomic.
      const step = Math.floor(nowSeconds / TOTP_STEP_SECONDS) + match.delta;
      const accepted = await prisma.user.updateMany({
        where: {
          ...successGuard,
          AND: [{ OR: [{ lastTotpStep: null }, { lastTotpStep: { lt: step } }] }],
        },
        data: { ...successfulLogin, lastTotpStep: step },
      });
      if (accepted.count !== 1) return rejectInvalidCode();
    } else if (BACKUP_CODE_PATTERN.test(input)) {
      const storedBackupCodes = user.backupCodes;
      const backupCodes: unknown = storedBackupCodes ? JSON.parse(storedBackupCodes) : [];
      if (!storedBackupCodes || !Array.isArray(backupCodes)) return rejectInvalidCode();

      let usedBackupCodeIndex = -1;
      for (let i = 0; i < backupCodes.length; i++) {
        if (typeof backupCodes[i] === 'string' && await bcrypt.compare(input, backupCodes[i])) {
          usedBackupCodeIndex = i;
          break;
        }
      }
      if (usedBackupCodeIndex < 0) return rejectInvalidCode();

      backupCodes.splice(usedBackupCodeIndex, 1);
      const consumed = await prisma.user.updateMany({
        where: {
          ...successGuard,
          backupCodes: storedBackupCodes,
        },
        data: {
          ...successfulLogin,
          backupCodes: JSON.stringify(backupCodes),
        },
      });
      if (consumed.count !== 1) return rejectInvalidCode();

      isBackupCode = true;
    } else {
      return rejectInvalidCode();
    }

    const sessionToken = signToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      purpose: 'session',
      tv: user.tokenVersion ?? 0,
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
