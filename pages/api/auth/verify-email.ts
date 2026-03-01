import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { rateLimitMiddleware, getClientIP } from '../../../lib/rateLimit';
import { sendWelcomeEmail } from '../../../lib/email';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // POST: Verify email with token
  if (req.method === 'POST') {
    return handleVerifyEmail(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleVerifyEmail(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    // Find user with this verification token
    const user = await prisma.user.findUnique({
      where: { verificationToken: token },
    });

    if (!user) {
      return res.status(400).json({ 
        error: 'Invalid or expired verification token',
        code: 'TOKEN_INVALID'
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return res.status(400).json({ 
        error: 'Email is already verified',
        code: 'ALREADY_VERIFIED'
      });
    }

    // Mark email as verified and clear the token
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        verificationToken: null,
      },
    });

    // Send welcome email (don't fail if email fails)
    try {
      await sendWelcomeEmail(user.email, user.name || 'there');
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

    return res.status(200).json({
      message: 'Email verified successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        emailVerified: updatedUser.emailVerified,
      },
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
