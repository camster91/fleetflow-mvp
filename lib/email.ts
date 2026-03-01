// Email service using SendGrid
import sgMail from '@sendgrid/mail';

// Initialize SendGrid with API key
const apiKey = process.env.SENDGRID_API_KEY;
if (apiKey) {
  sgMail.setApiKey(apiKey);
}

const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@fleetflow.io';
const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'FleetFlow';

// Base email template with brand styling
function getBaseEmailTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${APP_NAME}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
      padding: 32px 24px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 32px 24px;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-weight: 500;
      margin: 16px 0;
    }
    .footer {
      background-color: #f1f5f9;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }
    .footer a {
      color: #1e40af;
      text-decoration: none;
    }
    .warning {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px 16px;
      margin: 16px 0;
      border-radius: 0 4px 4px 0;
    }
    .info-box {
      background-color: #eff6ff;
      border: 1px solid #dbeafe;
      border-radius: 6px;
      padding: 16px;
      margin: 16px 0;
    }
    .code {
      font-family: 'Courier New', monospace;
      background-color: #f1f5f9;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 14px;
    }
    @media only screen and (max-width: 600px) {
      .container {
        width: 100% !important;
        border-radius: 0;
      }
      .content {
        padding: 24px 16px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${APP_NAME}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
      <p>
        <a href="${APP_URL}/privacy">Privacy Policy</a> |
        <a href="${APP_URL}/terms">Terms of Service</a> |
        <a href="${APP_URL}/support">Support</a>
      </p>
      <p style="margin-top: 16px; color: #94a3b8;">
        This email was sent from ${APP_URL}
      </p>
    </div>
  </div>
</body>
</html>`;
}

// Send email wrapper with error handling
export async function sendEmail({
  to,
  subject,
  html,
  text,
  from = FROM_EMAIL,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // If SendGrid is not configured, log the email for development
    if (!apiKey) {
      console.log('=== EMAIL (SendGrid not configured) ===');
      console.log('To:', to);
      console.log('Subject:', subject);
      console.log('Text:', text);
      console.log('======================================');
      return { success: true };
    }

    await sgMail.send({
      to,
      from,
      subject,
      html,
      text,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Email sending error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to send email' 
    };
  }
}

// Send verification email
export async function sendVerificationEmail(
  email: string,
  name: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const verificationUrl = `${APP_URL}/auth/verify-email/${token}`;
  
  const html = getBaseEmailTemplate(`
    <h2 style="margin-top: 0; color: #1e293b;">Verify Your Email Address</h2>
    <p>Hi ${name || 'there'},</p>
    <p>Welcome to ${APP_NAME}! Please verify your email address to complete your registration and start managing your fleet.</p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${verificationUrl}" class="button">Verify Email Address</a>
    </div>
    
    <div class="info-box">
      <p style="margin: 0;"><strong>Or copy and paste this link:</strong></p>
      <p style="margin: 8px 0 0 0; word-break: break-all;">
        <a href="${verificationUrl}" style="color: #1e40af;">${verificationUrl}</a>
      </p>
    </div>
    
    <div class="warning">
      <strong>Important:</strong> This verification link will expire in 24 hours.
    </div>
    
    <p style="color: #64748b; font-size: 14px;">
      If you didn't create an account with ${APP_NAME}, please ignore this email.
    </p>
  `);

  const text = `
Verify Your Email Address

Hi ${name || 'there'},

Welcome to ${APP_NAME}! Please verify your email address to complete your registration.

Click the link below to verify your email:
${verificationUrl}

This verification link will expire in 24 hours.

If you didn't create an account with ${APP_NAME}, please ignore this email.

---
${APP_NAME}
${APP_URL}
  `.trim();

  return sendEmail({
    to: email,
    subject: `Verify your email address - ${APP_NAME}`,
    html,
    text,
  });
}

// Send password reset email
export async function sendPasswordResetEmail(
  email: string,
  name: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const resetUrl = `${APP_URL}/auth/reset-password/${token}`;
  
  const html = getBaseEmailTemplate(`
    <h2 style="margin-top: 0; color: #1e293b;">Password Reset Request</h2>
    <p>Hi ${name || 'there'},</p>
    <p>We received a request to reset your password for your ${APP_NAME} account. Click the button below to set a new password:</p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </div>
    
    <div class="info-box">
      <p style="margin: 0;"><strong>Or copy and paste this link:</strong></p>
      <p style="margin: 8px 0 0 0; word-break: break-all;">
        <a href="${resetUrl}" style="color: #1e40af;">${resetUrl}</a>
      </p>
    </div>
    
    <div class="warning">
      <strong>Security Notice:</strong> This password reset link will expire in 1 hour for your security.
    </div>
    
    <p style="color: #64748b; font-size: 14px;">
      If you didn't request a password reset, please ignore this email or contact our support team if you have concerns.
    </p>
  `);

  const text = `
Password Reset Request

Hi ${name || 'there'},

We received a request to reset your password for your ${APP_NAME} account.

Click the link below to set a new password:
${resetUrl}

This password reset link will expire in 1 hour for your security.

If you didn't request a password reset, please ignore this email or contact our support team.

---
${APP_NAME}
${APP_URL}
  `.trim();

  return sendEmail({
    to: email,
    subject: `Password reset request - ${APP_NAME}`,
    html,
    text,
  });
}

// Send welcome email after verification
export async function sendWelcomeEmail(
  email: string,
  name: string,
  loginUrl: string = `${APP_URL}/auth/login`
): Promise<{ success: boolean; error?: string }> {
  const dashboardUrl = `${APP_URL}/dashboard`;
  
  const html = getBaseEmailTemplate(`
    <h2 style="margin-top: 0; color: #1e293b;">Welcome to ${APP_NAME}!</h2>
    <p>Hi ${name || 'there'},</p>
    <p>Your email has been verified and your account is now active. We're excited to help you streamline your fleet operations!</p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0; color: #1e40af;">Getting Started</h3>
      <ul style="margin: 0; padding-left: 20px;">
        <li>Add your vehicles to the fleet</li>
        <li>Set up your drivers and team members</li>
        <li>Create your first delivery route</li>
        <li>Explore our analytics and reporting tools</li>
      </ul>
    </div>
    
    <p>Need help getting started? Check out our <a href="${APP_URL}/docs" style="color: #1e40af;">documentation</a> or contact our <a href="${APP_URL}/support" style="color: #1e40af;">support team</a>.</p>
    
    <p style="color: #64748b; font-size: 14px;">
      If you have any questions, feel free to reply to this email or contact us through our support portal.
    </p>
  `);

  const text = `
Welcome to ${APP_NAME}!

Hi ${name || 'there'},

Your email has been verified and your account is now active. We're excited to help you streamline your fleet operations!

Get Started: ${dashboardUrl}

Quick Start Guide:
- Add your vehicles to the fleet
- Set up your drivers and team members
- Create your first delivery route
- Explore our analytics and reporting tools

Need help? Visit our documentation: ${APP_URL}/docs

If you have any questions, contact our support team: ${APP_URL}/support

---
${APP_NAME}
${APP_URL}
  `.trim();

  return sendEmail({
    to: email,
    subject: `Welcome to ${APP_NAME}!`,
    html,
    text,
  });
}

// Send 2FA backup codes email
export async function sendBackupCodesEmail(
  email: string,
  name: string,
  backupCodes: string[]
): Promise<{ success: boolean; error?: string }> {
  const codesHtml = backupCodes.map(code => 
    `<code class="code" style="display: inline-block; margin: 4px; padding: 8px 12px; font-size: 16px;">${code}</code>`
  ).join('');
  
  const codesText = backupCodes.join('\n');
  
  const html = getBaseEmailTemplate(`
    <h2 style="margin-top: 0; color: #1e293b;">Two-Factor Authentication Backup Codes</h2>
    <p>Hi ${name || 'there'},</p>
    <p>You've enabled two-factor authentication on your ${APP_NAME} account. Here are your backup codes:</p>
    
    <div class="info-box" style="text-align: center;">
      ${codesHtml}
    </div>
    
    <div class="warning">
      <strong>Important:</strong> Save these codes in a secure location. Each code can only be used once. If you lose access to your authenticator app, you'll need these codes to sign in.
    </div>
    
    <p style="color: #64748b; font-size: 14px;">
      These codes were generated when you set up 2FA. If you didn't enable 2FA or believe your account has been compromised, please contact support immediately.
    </p>
  `);

  const text = `
Two-Factor Authentication Backup Codes

Hi ${name || 'there'},

You've enabled two-factor authentication on your ${APP_NAME} account. Here are your backup codes:

${codesText}

IMPORTANT: Save these codes in a secure location. Each code can only be used once. 
If you lose access to your authenticator app, you'll need these codes to sign in.

If you didn't enable 2FA or believe your account has been compromised, please contact support immediately.

---
${APP_NAME}
${APP_URL}
  `.trim();

  return sendEmail({
    to: email,
    subject: `Your 2FA Backup Codes - ${APP_NAME}`,
    html,
    text,
  });
}

// Send security alert email
export async function sendSecurityAlertEmail(
  email: string,
  name: string,
  alertType: 'login' | 'password_changed' | '2fa_enabled' | '2fa_disabled',
  details: { ip?: string; location?: string; time?: string; device?: string }
) {
  const alertMessages = {
    login: {
      title: 'New Sign-In Detected',
      message: 'A new sign-in was detected on your account.',
    },
    password_changed: {
      title: 'Password Changed',
      message: 'Your password was recently changed.',
    },
    '2fa_enabled': {
      title: 'Two-Factor Authentication Enabled',
      message: 'Two-factor authentication has been enabled on your account.',
    },
    '2fa_disabled': {
      title: 'Two-Factor Authentication Disabled',
      message: 'Two-factor authentication has been disabled on your account.',
    },
  };

  const alert = alertMessages[alertType];
  if (!alert) {
    return { success: false, error: 'Invalid alert type' };
  }
  const settingsUrl = `${APP_URL}/settings/security`;
  
  const html = getBaseEmailTemplate(`
    <h2 style="margin-top: 0; color: #1e293b;">${alert.title}</h2>
    <p>Hi ${name || 'there'},</p>
    <p>${alert.message}</p>
    
    ${details.ip ? `
    <div class="info-box">
      <h4 style="margin-top: 0; color: #1e40af;">Details</h4>
      <p style="margin: 4px 0;"><strong>IP Address:</strong> ${details.ip}</p>
      ${details.location ? `<p style="margin: 4px 0;"><strong>Location:</strong> ${details.location}</p>` : ''}
      ${details.device ? `<p style="margin: 4px 0;"><strong>Device:</strong> ${details.device}</p>` : ''}
      ${details.time ? `<p style="margin: 4px 0;"><strong>Time:</strong> ${details.time}</p>` : ''}
    </div>
    ` : ''}
    
    <div class="warning">
      <strong>Not you?</strong> If you don't recognize this activity, please secure your account immediately by changing your password.
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${settingsUrl}" class="button">Review Account Security</a>
    </div>
  `);

  const text = `
${alert.title}

Hi ${name || 'there'},

${alert.message}

${details.ip ? `Details:
- IP Address: ${details.ip}
${details.location ? `- Location: ${details.location}` : ''}
${details.device ? `- Device: ${details.device}` : ''}
${details.time ? `- Time: ${details.time}` : ''}
` : ''}

Not you? If you don't recognize this activity, please secure your account immediately:
${settingsUrl}

---
${APP_NAME}
${APP_URL}
  `.trim();

  return sendEmail({
    to: email,
    subject: `Security Alert: ${alert.title} - ${APP_NAME}`,
    html,
    text,
  });
}

// Send account locked notification
export async function sendAccountLockedEmail(
  email: string,
  name: string,
  lockDuration: string
): Promise<{ success: boolean; error?: string }> {
  const supportUrl = `${APP_URL}/support`;
  
  const html = getBaseEmailTemplate(`
    <h2 style="margin-top: 0; color: #1e293b;">Account Temporarily Locked</h2>
    <p>Hi ${name || 'there'},</p>
    <p>Your ${APP_NAME} account has been temporarily locked due to multiple failed sign-in attempts.</p>
    
    <div class="info-box">
      <p style="margin: 0;"><strong>Lock Duration:</strong> ${lockDuration}</p>
      <p style="margin: 8px 0 0 0;">You can try signing in again after this period.</p>
    </div>
    
    <div class="warning">
      <strong>Didn't attempt to sign in?</strong> Someone may be trying to access your account. We recommend changing your password once your account is unlocked.
    </div>
    
    <p>If you need immediate assistance or believe this was done in error, please contact our support team.</p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${supportUrl}" class="button">Contact Support</a>
    </div>
  `);

  const text = `
Account Temporarily Locked

Hi ${name || 'there'},

Your ${APP_NAME} account has been temporarily locked due to multiple failed sign-in attempts.

Lock Duration: ${lockDuration}
You can try signing in again after this period.

Didn't attempt to sign in? Someone may be trying to access your account. 
We recommend changing your password once your account is unlocked.

Need help? Contact our support team: ${supportUrl}

---
${APP_NAME}
${APP_URL}
  `.trim();

  return sendEmail({
    to: email,
    subject: `Account Locked - ${APP_NAME}`,
    html,
    text,
  });
}

// Re-export for convenience
export { FROM_EMAIL, APP_URL, APP_NAME };
