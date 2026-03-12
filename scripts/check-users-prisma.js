#!/usr/bin/env node

/**
 * Check users using Prisma client
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Checking users with Prisma...\n');
  
  try {
    // Check database connection
    await prisma.$connect();
    console.log('✅ Connected to database');
    
    // Get all users
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`\nFound ${users.length} user(s):\n`);
    
    for (const user of users) {
      console.log(`ID: ${user.id}`);
      console.log(`Email: ${user.email}`);
      console.log(`Name: ${user.name || 'N/A'}`);
      console.log(`Role: ${user.role}`);
      console.log(`Email Verified: ${user.emailVerified ? 'Yes' : 'No'}`);
      console.log(`Created: ${user.createdAt}`);
      
      if (user.password) {
        console.log(`Password hash: ${user.password.substring(0, 20)}...`);
        console.log(`Hash length: ${user.password.length}`);
        
        // Test if password "admin123" matches the hash
        if (user.email === 'admin@fleetflow.com') {
          try {
            const match = await bcrypt.compare('admin123', user.password);
            console.log(`Password "admin123" matches hash: ${match ? '✅ YES' : '❌ NO'}`);
            
            if (!match) {
              // Try without bcrypt (plain text?)
              console.log(`Password is plain text? ${user.password === 'admin123' ? '✅ YES' : '❌ NO'}`);
              
              // Try other common passwords
              const testPasswords = ['password', 'Password123', 'Admin123', 'admin', 'Admin@123'];
              for (const testPwd of testPasswords) {
                const testMatch = await bcrypt.compare(testPwd, user.password);
                if (testMatch) {
                  console.log(`Found matching password: "${testPwd}"`);
                  break;
                }
              }
            }
          } catch (err) {
            console.log('Error comparing password:', err.message);
          }
        }
      } else {
        console.log('Password: NULL or empty');
      }
      
      console.log('---\n');
    }
    
    // Check for accounts (NextAuth)
    try {
      const accounts = await prisma.account.findMany({
        take: 5
      });
      console.log(`\nFound ${accounts.length} account(s) in Account table (NextAuth):`);
      accounts.forEach(acc => {
        console.log(`  - User ID: ${acc.userId}, Type: ${acc.type}, Provider: ${acc.provider}`);
      });
    } catch (err) {
      console.log('\nNo Account table or error accessing it:', err.message);
    }
    
    // Check for sessions (NextAuth)
    try {
      const sessions = await prisma.session.findMany({
        take: 5
      });
      console.log(`\nFound ${sessions.length} session(s) in Session table (NextAuth):`);
      sessions.forEach(sess => {
        console.log(`  - User ID: ${sess.userId}, Expires: ${sess.expires}`);
      });
    } catch (err) {
      console.log('\nNo Session table or error accessing it:', err.message);
    }
    
    // Test creating a new user with registration logic
    console.log('\n--- Testing user creation ---');
    const testEmail = `test${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    
    try {
      const hashedPassword = await bcrypt.hash(testPassword, 12);
      console.log(`Test password hash (cost 12): ${hashedPassword.substring(0, 30)}...`);
      
      // Check if we can create a user
      const existingUser = await prisma.user.findUnique({
        where: { email: 'admin@fleetflow.com' }
      });
      
      if (existingUser) {
        console.log('\n✅ Admin user exists in database');
        console.log(`   Trying to login with bcrypt compare...`);
        
        // Try to verify the password
        const isValid = await bcrypt.compare('admin123', existingUser.password);
        console.log(`   Password "admin123" is ${isValid ? 'VALID' : 'INVALID'}`);
        
        if (!isValid) {
          console.log('\n⚠️  Password mismatch! Possible issues:');
          console.log('   1. Wrong password stored in database');
          console.log('   2. Different bcrypt cost factor');
          console.log('   3. Password was hashed with different algorithm');
          console.log('   4. Database password field is not being used by NextAuth');
          
          // Try to update the password
          console.log('\n🔄 Updating admin password to "admin123" with bcrypt...');
          const newHash = await bcrypt.hash('admin123', 12);
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { password: newHash }
          });
          console.log('✅ Admin password updated!');
        }
      }
    } catch (err) {
      console.log('Error testing user creation:', err.message);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
    console.log('\n✅ Database connection closed');
  }
}

main().catch(console.error);