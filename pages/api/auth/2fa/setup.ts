import { NextApiRequest, NextApiResponse } from 'next';
import { getUserFromRequest } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { encryptSecret } from '../../../../lib/cryptoSecrets';
import { generateBackupCodes } from '../../../../lib/tokens';
import { assertSameOrigin } from '../../../../lib/apiAuth';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';

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

    const userId = session.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({
        error: 'Two-factor authentication is already enabled',
        code: '2FA_ALREADY_ENABLED',
      });
    }

    const secret = speakeasy.generateSecret({
      name: `Fleetvera:${user.email}`,
      issuer: process.env.TWO_FACTOR_ISSUER || 'Fleetvera',
      length: 32,
    });
    const backupCodes = generateBackupCodes(10);
    const hashedBackupCodes = backupCodes.map((code) => bcrypt.hashSync(code, 10));

    // Store the encrypted seed and hashes together so verification can prove it
    // is enabling the exact setup snapshot returned to this client.
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: encryptSecret(secret.base32),
        backupCodes: JSON.stringify(hashedBackupCodes),
      },
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');

    return res.status(200).json({
      message: '2FA setup initiated',
      // Returned only during setup initiation — never again after enable
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32,
      backupCodes,
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
