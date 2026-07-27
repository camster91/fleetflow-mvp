import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { rateLimitMiddleware, getClientIP } from '../../../lib/rateLimit';
import { generateVerificationToken, hashToken } from '../../../lib/tokens';
import { sendVerificationEmail } from '../../../lib/email';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Apply rate limiting per email
    const rateLimitKey = email.toLowerCase();
    const allowed = await rateLimitMiddleware(req, res, 'verifyEmail', rateLimitKey);
    if (!allowed) return;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Don't reveal if user exists
    if (!user) {
      return res.status(200).json({ 
        message: 'If an account exists, a verification email has been sent' 
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return res.status(400).json({ 
        error: 'Email is already verified',
        code: 'ALREADY_VERIFIED'
      });
    }

    const verificationToken = generateVerificationToken();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken: hashToken(verificationToken),
      },
    });

    const emailResult = await sendVerificationEmail(
      user.email,
      user.name || 'there',
      verificationToken
    );

    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error);
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    return res.status(200).json({
      message: 'Verification email sent successfully',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
