#!/usr/bin/env node
/**
 * Creates admin user in Supabase
 * Usage: node scripts/create-supabase-admin.js <SERVICE_ROLE_KEY>
 * 
 * Get your service role key from:
 * https://supabase.com/dashboard/project/vmvojkmaiuwidrduiotn/settings/api
 */

const https = require('https');

const SUPABASE_URL = 'https://vmvojkmaiuwidrduiotn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtdm9qa21haXV3aWRyZHVpb3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODY4ODksImV4cCI6MjA4Nzk2Mjg4OX0.iXMJCfzWOtPlvCNYZsIjjNZniPbkvoBkzbJYtj9bEyE';

const SERVICE_ROLE_KEY = process.argv[2] || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY === 'your_service_role_key_here') {
  console.error('\n❌ Service role key required!');
  console.error('\nUsage: node scripts/create-supabase-admin.js <YOUR_SERVICE_ROLE_KEY>');
  console.error('\nGet it from:');
  console.error('  https://supabase.com/dashboard/project/vmvojkmaiuwidrduiotn/settings/api');
  console.error('  → look for "service_role" key (keep secret!)\n');
  process.exit(1);
}

function apiRequest(path, method, body, key) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'vmvojkmaiuwidrduiotn.supabase.co',
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseBody) });
        } catch {
          resolve({ status: res.statusCode, data: responseBody });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🚀 FleetFlow Admin Setup\n');

  // Step 1: Create auth user
  console.log('1. Creating admin user in Supabase Auth...');
  const createRes = await apiRequest('/auth/v1/admin/users', 'POST', {
    email: 'admin@fleetflow.com',
    password: 'admin123',
    email_confirm: true,
    user_metadata: {
      name: 'Admin User',
      role: 'admin',
    },
  }, SERVICE_ROLE_KEY);

  let userId;
  if (createRes.status === 200 || createRes.status === 201) {
    userId = createRes.data.id;
    console.log(`   ✅ Auth user created: ${userId}`);
  } else if (createRes.data?.msg?.includes('already been registered') || createRes.data?.error_code === 'email_exists') {
    console.log('   ℹ️  Auth user already exists, fetching...');
    // Get the existing user
    const listRes = await apiRequest('/auth/v1/admin/users?per_page=1000', 'GET', null, SERVICE_ROLE_KEY);
    if (listRes.status === 200) {
      const users = listRes.data.users || [];
      const existing = users.find(u => u.email === 'admin@fleetflow.com');
      if (existing) {
        userId = existing.id;
        // Update password and confirm email
        await apiRequest(`/auth/v1/admin/users/${userId}`, 'PUT', {
          password: 'admin123',
          email_confirm: true,
          user_metadata: { name: 'Admin User', role: 'admin' },
        }, SERVICE_ROLE_KEY);
        console.log(`   ✅ Auth user updated: ${userId}`);
      }
    }
  } else {
    console.error('   ❌ Failed:', JSON.stringify(createRes.data));
    process.exit(1);
  }

  if (!userId) {
    console.error('   ❌ Could not get user ID');
    process.exit(1);
  }

  // Step 2: Upsert public.users profile
  console.log('\n2. Creating/updating admin profile in public.users...');
  const profileRes = await apiRequest(
    '/rest/v1/users',
    'POST',
    {
      id: userId,
      email: 'admin@fleetflow.com',
      name: 'Admin User',
      role: 'admin',
      company: 'FleetFlow',
    },
    SERVICE_ROLE_KEY
  );

  // Headers need Prefer: resolution=merge-duplicates for upsert
  // Use a different approach with PATCH if INSERT fails
  if (profileRes.status === 201 || profileRes.status === 200) {
    console.log('   ✅ Profile created');
  } else if (profileRes.status === 409 || profileRes.status === 422) {
    // Update existing
    const updateRes = await apiRequest(
      `/rest/v1/users?id=eq.${userId}`,
      'PATCH',
      { role: 'admin', name: 'Admin User', company: 'FleetFlow' },
      SERVICE_ROLE_KEY
    );
    if (updateRes.status >= 200 && updateRes.status < 300) {
      console.log('   ✅ Profile updated');
    } else {
      console.warn('   ⚠️  Could not update profile (may need SQL):',  JSON.stringify(updateRes.data));
    }
  } else {
    console.warn('   ⚠️  Profile note:', profileRes.status, JSON.stringify(profileRes.data));
    console.log('   ℹ️  Run this SQL in Supabase Dashboard → SQL Editor:');
    console.log(`   INSERT INTO public.users (id, email, name, role, company)`);
    console.log(`   VALUES ('${userId}', 'admin@fleetflow.com', 'Admin User', 'admin', 'FleetFlow')`);
    console.log(`   ON CONFLICT (id) DO UPDATE SET role = 'admin', name = 'Admin User';`);
  }

  console.log('\n✅ Admin setup complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌐 URL:      https://fleet.ashbi.ca/auth/login');
  console.log('📧 Email:    admin@fleetflow.com');
  console.log('🔑 Password: admin123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
