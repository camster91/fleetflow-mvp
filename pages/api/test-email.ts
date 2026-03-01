import type { NextApiRequest, NextApiResponse } from 'next';
import { sendVerificationEmail } from '@/lib/email';

/**
 * Test email configuration endpoint
 * POST /api/test-email
 * Body: { email: string }
 * 
 * This sends a test verification email to verify Mailgun is configured correctly.
 * Only available in production for admin testing.
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email address is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if Mailgun is configured
    const mailgunConfigured = !!(
      process.env.MAILGUN_API_KEY && 
      process.env.MAILGUN_DOMAIN
    );

    if (!mailgunConfigured) {
      return res.status(503).json({ 
        error: 'Email service not configured',
        details: {
          mailgunApiKey: process.env.MAILGUN_API_KEY ? 'Set' : 'Not set',
          mailgunDomain: process.env.MAILGUN_DOMAIN || 'Not set',
          fromEmail: process.env.FROM_EMAIL || 'Not set',
        },
        message: 'Mailgun environment variables are missing. Please configure them in Coolify.'
      });
    }

    // Send test verification email
    const testToken = `test-${Date.now()}`;
    const result = await sendVerificationEmail(email, 'Test User', testToken);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Test email sent successfully',
        details: {
          to: email,
          from: process.env.FROM_EMAIL,
          timestamp: new Date().toISOString(),
        }
      });
    } else {
      return res.status(500).json({
        error: 'Failed to send test email',
        details: result.error,
        config: {
          domain: process.env.MAILGUN_DOMAIN,
          from: process.env.FROM_EMAIL,
        }
      });
    }
  } catch (error: any) {
    console.error('Test email error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}
