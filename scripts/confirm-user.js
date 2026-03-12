#!/usr/bin/env node
/**
 * Supabase User Confirmation Script
 * 
 * This script confirms a user's email manually when Supabase email is not configured.
 * 
 * Usage:
 *   SUPABASE_URL=https://your-project.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
 *   node scripts/confirm-user.js user@example.com
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  console.error('');
  console.error('Get your service role key from:');
  console.error('https://supabase.com/dashboard/project/_/settings/api');
  console.error('');
  console.error('Usage:');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your-key node scripts/confirm-user.js user@example.com');
  process.exit(1);
}

const userEmail = process.argv[2];

if (!userEmail) {
  console.error('❌ Error: Please provide an email address');
  console.error('Usage: node scripts/confirm-user.js user@example.com');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function confirmUser() {
  try {
    console.log(`🔍 Looking up user: ${userEmail}`);
    
    // List users to find the one with matching email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      throw listError;
    }
    
    const user = users.find(u => u.email === userEmail);
    
    if (!user) {
      console.error(`❌ User not found: ${userEmail}`);
      console.error('Available users:');
      users.forEach(u => console.error(`  - ${u.email} (confirmed: ${u.email_confirmed_at !== null})`));
      process.exit(1);
    }
    
    console.log(`✅ Found user: ${user.id}`);
    console.log(`   Email confirmed: ${user.email_confirmed_at !== null}`);
    
    if (user.email_confirmed_at) {
      console.log('   User is already confirmed!');
      return;
    }
    
    // Update user to confirm email
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    );
    
    if (error) {
      throw error;
    }
    
    console.log('✅ User email confirmed successfully!');
    console.log('');
    console.log('The user can now log in with their password.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// List all unconfirmed users
async function listUnconfirmedUsers() {
  try {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) throw error;
    
    const unconfirmed = users.filter(u => !u.email_confirmed_at);
    
    console.log('\n📋 Unconfirmed Users:');
    console.log('=====================');
    
    if (unconfirmed.length === 0) {
      console.log('No unconfirmed users found.');
    } else {
      unconfirmed.forEach(u => {
        console.log(`  - ${u.email} (created: ${u.created_at})`);
      });
    }
    
    console.log('\nTo confirm a user, run:');
    console.log(`  SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/confirm-user.js <email>`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

if (userEmail === '--list') {
  listUnconfirmedUsers();
} else {
  confirmUser();
}
