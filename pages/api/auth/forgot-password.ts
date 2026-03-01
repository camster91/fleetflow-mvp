import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { rateLimitMiddleware, getClientIP } from '../../../lib/rateLimit';
import { generatePasswordResetToken, getExpiryDate, TOKEN_EXPIRY } from '../../../lib/tokens';
import { sendPasswordResetEmail } from '../../../lib/email';

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
    const allowed = await rateLimitMiddleware(req, res, 'passwordReset', rateLimitKey);
    if (!allowed) return;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Don't reveal if user exists - security best practice
    if (!user) {
      return res.status(200).json({ 
        message: 'If an account exists, a password reset email has been sent' 
      });
    }

    // Check if user is a social-only account (no password)
    if (!user.password) {
      return res.status(200).json({ 
        message: 'If an account exists, a password reset email has been sent' 
      });
    }

    // Generate password reset token
    const resetToken = generatePasswordResetToken();
    const resetExpires = getExpiryDate(TOKEN_EXPIRY.passwordReset);

    // Update user with reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    // Send password reset email
    const emailResult = await sendPasswordResetEmail(
      user.email,
      user.name || 'there',
      resetToken
    );

    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error);
      return res.status(500).json({ error: 'Failed to send password reset email' });
    }

    return res.status(200).json({
      message: 'Password reset email sent successfully',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
