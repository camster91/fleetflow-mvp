import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { rateLimitMiddleware } from '../../../lib/rateLimit';
import { validatePassword } from '../../../lib/security';
import bcrypt from 'bcryptjs';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // GET: Validate token (check if valid)
  if (req.method === 'GET') {
    return handleValidateToken(req, res);
  }

  // POST: Reset password
  if (req.method === 'POST') {
    return handleResetPassword(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleValidateToken(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Find user with this reset token
    const user = await prisma.user.findUnique({
      where: { passwordResetToken: token },
    });

    if (!user) {
      return res.status(400).json({ 
        error: 'Invalid or expired reset token',
        valid: false 
      });
    }

    // Check if token is expired
    if (!user.passwordResetExpires || new Date() > user.passwordResetExpires) {
      return res.status(400).json({ 
        error: 'Reset token has expired',
        valid: false,
        expired: true
      });
    }

    return res.status(200).json({
      valid: true,
      email: user.email,
    });
  } catch (error) {
    console.error('Token validation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleResetPassword(req: NextApiRequest, res: NextApiResponse) {
  // Apply rate limiting
  const allowed = await rateLimitMiddleware(req, res, 'passwordReset');
  if (!allowed) return;

  try {
    const { token, password } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Reset token is required' });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'New password is required' });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ 
        error: 'Password does not meet requirements',
        details: passwordValidation.errors 
      });
    }

    // Find user with this reset token
    const user = await prisma.user.findUnique({
      where: { passwordResetToken: token },
    });

    if (!user) {
      return res.status(400).json({ 
        error: 'Invalid or expired reset token',
        code: 'TOKEN_INVALID'
      });
    }

    // Check if token is expired
    if (!user.passwordResetExpires || new Date() > user.passwordResetExpires) {
      return res.status(400).json({ 
        error: 'Reset token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        // Reset failed login attempts
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      },
    });

    // TODO: Invalidate all existing sessions for this user
    // This would require storing session IDs and checking them

    return res.status(200).json({
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
