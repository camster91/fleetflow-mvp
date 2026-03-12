// Script to create a test user in Supabase
// Usage: node create-test-user.js <email> <password> <name>

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.production' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Check your .env.production file.');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUser(email, password, name) {
  console.log(`Creating test user: ${email} (${name})`);
  
  try {
    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: 'fleet_manager'
      }
    });

    if (authError) {
      throw new Error(`Auth error: ${authError.message}`);
    }

    console.log('Auth user created:', authData.user.id);

    // Create user profile
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        name,
        role: 'fleet_manager',
        created_at: new Date().toISOString()
      });

    if (profileError) {
      // Rollback auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error(`Profile error: ${profileError.message}`);
    }

    console.log('User profile created successfully');
    console.log('Test user created successfully!');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('\nYou can now login with these credentials.');
    
  } catch (error) {
    console.error('Error creating test user:', error.message);
    process.exit(1);
  }
}

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('Usage: node create-test-user.js <email> <password> <name>');
  console.log('Example: node create-test-user.js test@example.com "Test123!" "Test User"');
  process.exit(1);
}

const [email, password, name] = args;
createTestUser(email, password, name);