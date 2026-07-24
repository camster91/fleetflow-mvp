#!/usr/bin/env node

/**
 * Create admin user directly in PostgreSQL database via Prisma.
 * Requires ADMIN_PASSWORD (min 12 chars). Does not embed default credentials.
 *
 * Usage:
 *   ADMIN_PASSWORD='your-strong-password' node scripts/create-admin.js
 */

const bcrypt = require('bcryptjs');

async function createAdminWithPrisma() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@fleetflow.com';
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || adminPassword.length < 12) {
    console.error('❌ Refusing to run: set ADMIN_PASSWORD to a strong value (min 12 characters).');
    console.error('   Example: ADMIN_PASSWORD="$(openssl rand -base64 18)" node scripts/create-admin.js');
    return false;
  }

  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    await prisma.$connect();
    console.log('✅ Connected to database via Prisma');

    const adminUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    if (adminUser) {
      console.log('✅ Admin user already exists — rotating password from ADMIN_PASSWORD');
      await prisma.user.update({
        where: { id: adminUser.id },
        data: {
          password: hashedPassword,
          emailVerified: new Date(),
          role: 'admin',
        },
      });
      console.log(`   Email: ${adminUser.email}`);
      console.log('   Password: (set from ADMIN_PASSWORD — not printed)');
    } else {
      console.log('👤 Creating admin user...');
      const admin = await prisma.user.create({
        data: {
          name: 'Admin User',
          email: adminEmail,
          password: hashedPassword,
          role: 'admin',
          company: 'FleetFlow',
          emailVerified: new Date(),
        },
      });
      console.log('✅ Admin user created!');
      console.log(`   Email: ${admin.email}`);
      console.log('   Password: (set from ADMIN_PASSWORD — not printed)');
      console.log(`   Role: ${admin.role}`);
    }

    await prisma.$disconnect();
    return true;
  } catch (error) {
    console.error('❌ Prisma error:', error.message);
    return false;
  }
}

async function main() {
  console.log('🔧 Creating/verifying admin user...\n');

  const success = await createAdminWithPrisma();

  if (!success) {
    console.log('\n❌ Failed to create admin user');
    console.log('💡 Try:');
    console.log('   1. Export ADMIN_PASSWORD with a strong value');
    console.log('   2. Check DATABASE_URL is set correctly');
    console.log('   3. Check PostgreSQL is running and accessible');
    console.log('   4. Run "npx prisma db push" to create tables');
    process.exit(1);
  }

  console.log('\n🎉 Admin user setup complete!');
  console.log('   Login at: https://fleet.ashbi.ca/auth/login');
  console.log(`   Email: ${process.env.ADMIN_EMAIL || 'admin@fleetflow.com'}`);
  console.log('   Password: (the ADMIN_PASSWORD you supplied)');
}

main().catch(console.error);
