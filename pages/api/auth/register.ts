import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import bcrypt from 'bcryptjs';
import { rateLimitMiddleware, getClientIP } from '../../../lib/rateLimit';
import { generateVerificationToken, getExpiryDate, TOKEN_EXPIRY } from '../../../lib/tokens';
import { sendVerificationEmail } from '../../../lib/email';
import { validatePassword } from '../../../lib/security';

// Allowed roles for self-registration (admin cannot be self-assigned)
const ALLOWED_ROLES = ['fleet_manager', 'dispatch', 'driver', 'maintenance', 'safety_officer', 'finance'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];

// Basic email format validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Apply rate limiting
  const ip = getClientIP(req);
  const allowed = await rateLimitMiddleware(req, res, 'register', ip);
  if (!allowed) return;

  try {
    const { name, email, password, company, role } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate name
    if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100) {
      return res.status(400).json({ error: 'Name must be between 1 and 100 characters' });
    }

    // Validate email format
    if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ 
        error: 'Password does not meet requirements',
        details: passwordValidation.errors 
      });
    }

    // Validate role — must be from the allowed set; admin cannot be self-assigned
    const assignedRole: AllowedRole = ALLOWED_ROLES.includes(role) ? role : 'fleet_manager';

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      // Don't reveal if user exists - security best practice
      return res.status(400).json({ error: 'Unable to create account' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate verification token
    const verificationToken = generateVerificationToken();
    const verificationExpires = getExpiryDate(TOKEN_EXPIRY.verification);

    // Create user with verification token
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase(),
        password: hashedPassword,
        company: company || null,
        role: assignedRole,
        verificationToken,
        // Email will be verified when they click the link
        failedLoginAttempts: 0,
      },
    });

    // Send verification email (don't fail if email fails)
    let emailSent = false;
    try {
      const emailResult = await sendVerificationEmail(
        user.email,
        user.name || 'there',
        verificationToken
      );
      emailSent = emailResult.success;
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
    }

    // Remove sensitive data from response
    const { password: _, verificationToken: __, twoFactorSecret: ___, ...userWithoutSensitive } = user;

    return res.status(201).json({
      message: 'User created successfully',
      user: userWithoutSensitive,
      emailSent,
      requiresVerification: true,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
