#!/usr/bin/env node

/**
 * Fix Authentication for FleetFlow Pro
 * Run this in Coolify terminal after setting environment variables
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 FleetFlow Pro Auth Fix');
  console.log('=========================\n');

  // Check if database file exists
  const dbFile = './prod.db';
  const dbExists = fs.existsSync(dbFile);
  
  if (!dbExists) {
    console.log('📦 Database file not found. Creating...');
    try {
      // Push schema
      execSync('npx prisma db push', { stdio: 'inherit' });
      console.log('✅ Database schema created');
    } catch (error) {
      console.error('❌ Failed to create database schema:', error.message);
      process.exit(1);
    }
  } else {
    console.log('✅ Database file exists');
    
    // Check if schema is applied
    try {
      const userCount = await prisma.user.count();
      console.log(`✅ Database has ${userCount} user(s)`);
    } catch (error) {
      console.log('⚠️ Database schema may not be applied. Running db push...');
      execSync('npx prisma db push', { stdio: 'inherit' });
    }
  }

  // Check for admin user
  console.log('\n👥 Checking for admin user...');
  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin@fleetflow.com' }
  });

  if (adminUser) {
    console.log('✅ Admin user exists');
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Role: ${adminUser.role}`);
    console.log(`   Verified: ${adminUser.emailVerified ? 'Yes' : 'No'}`);
    
    // Verify if not verified
    if (!adminUser.emailVerified) {
      console.log('⚠️ Admin user not verified. Verifying...');
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { emailVerified: new Date() }
      });
      console.log('✅ Admin user verified');
    }
  } else {
    console.log('👤 Creating admin user...');
    const hashedPassword = await bcrypt.hash('admin123', 12);
    try {
      const newAdmin = await prisma.user.create({
        data: {
          name: 'Admin User',
          email: 'admin@fleetflow.com',
          password: hashedPassword,
          role: 'admin',
          company: 'FleetFlow',
          emailVerified: new Date(), // Verified immediately
        }
      });
      console.log('✅ Admin user created:');
      console.log(`   Email: ${newAdmin.email}`);
      console.log(`   Password: admin123`);
      console.log(`   Role: ${newAdmin.role}`);
    } catch (error) {
      console.error('❌ Failed to create admin user:', error.message);
    }
  }

  // List all users
  console.log('\n📋 All Users:');
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      verificationToken: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  allUsers.forEach((user, index) => {
    console.log(`${index + 1}. ${user.email} (${user.role})`);
    console.log(`   Name: ${user.name || 'N/A'}`);
    console.log(`   Verified: ${user.emailVerified ? 'Yes' : 'No'}`);
    if (!user.emailVerified && user.verificationToken) {
      console.log(`   Verification Token: ${user.verificationToken}`);
      console.log(`   To verify: curl -X POST https://fleet.ashbi.ca/api/auth/verify-email -H "Content-Type: application/json" -d '{"token":"${user.verificationToken}"}'`);
    }
    console.log('');
  });

  // Verify any unverified users (optional)
  const unverifiedUsers = allUsers.filter(u => !u.emailVerified);
  if (unverifiedUsers.length > 0) {
    console.log('🔄 Verifying all unverified users...');
    for (const user of unverifiedUsers) {
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          emailVerified: new Date(),
          verificationToken: null 
        }
      });
      console.log(`✅ Verified: ${user.email}`);
    }
  }

  console.log('\n🎉 Setup Complete!');
  console.log('================');
  console.log('You can now login at: https://fleet.ashbi.ca');
  console.log('Admin credentials:');
  console.log('  Email: admin@fleetflow.com');
  console.log('  Password: admin123');
  console.log('\nOther login options:');
  console.log('  - Use any user from the list above');
  console.log('  - Register new users at: https://fleet.ashbi.ca/auth/register');

  await prisma.$disconnect();
}

// Handle errors
main().catch(async (error) => {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  await prisma.$disconnect();
  process.exit(1);
});