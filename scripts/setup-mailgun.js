#!/usr/bin/env node
/**
 * Mailgun Setup Script for FleetFlow
 * 
 * This script helps configure Mailgun and test email delivery
 * 
 * Usage:
 *   node scripts/setup-mailgun.js
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer.trim()));
  });
}

async function main() {
  console.log('🔧 FleetFlow Mailgun Setup\n');
  console.log('=====================================\n');

  // Check current env
  console.log('Current Environment Variables:');
  console.log(`MAILGUN_API_KEY: ${process.env.MAILGUN_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`MAILGUN_DOMAIN: ${process.env.MAILGUN_DOMAIN || 'fleetflow.ashbi.ca'}`);
  console.log(`FROM_EMAIL: ${process.env.FROM_EMAIL || 'FleetFlow <notifications@fleetflow.ashbi.ca>'}`);
  console.log('');

  console.log('📋 To configure Mailgun on the live site:');
  console.log('');
  console.log('1. Go to https://coolify.ashbi.ca/project/6');
  console.log('2. Click on the FleetFlow service');
  console.log('3. Go to "Environment Variables" tab');
  console.log('4. Add/update these variables:\n');

  console.log('Required Variables:');
  console.log('-------------------');
  console.log('MAILGUN_API_KEY=your-mailgun-private-api-key');
  console.log('MAILGUN_DOMAIN=fleetflow.ashbi.ca');
  console.log('MAILGUN_BASE_URL=https://api.mailgun.net/v3');
  console.log('FROM_EMAIL=FleetFlow <notifications@fleetflow.ashbi.ca>');
  console.log('');

  console.log('📧 Testing Email Configuration:');
  console.log('================================\n');

  const testEmail = await question('Enter email address to test (or press Enter to skip): ');
  
  if (testEmail) {
    console.log(`\n🔄 Testing email to ${testEmail}...\n`);
    
    // Dynamically import the email module
    try {
      const { sendVerificationEmail } = await import('../lib/email.ts');
      const result = await sendVerificationEmail(testEmail, 'Test User', 'test-token-123');
      
      if (result.success) {
        console.log('✅ Email sent successfully!');
        console.log('Check your inbox (and spam folder) for the test email.');
      } else {
        console.log('❌ Failed to send email:', result.error);
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
      console.log('\nNote: This script needs to run with ts-node or after building.');
    }
  }

  console.log('\n📖 Next Steps:');
  console.log('--------------');
  console.log('1. Add Mailgun env vars to Coolify');
  console.log('2. Redeploy the application');
  console.log('3. Test registration flow on https://fleet.ashbi.ca/auth/register');
  console.log('4. Verify emails are being delivered');
  console.log('');

  console.log('🌐 Mailgun Dashboard:');
  console.log('   https://app.mailgun.com/app/dashboard');
  console.log('');

  rl.close();
}

main().catch(console.error);
