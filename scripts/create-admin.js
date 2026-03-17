#!/usr/bin/env node

/**
 * Create admin user directly in PostgreSQL database via Prisma
 */

const bcrypt = require('bcryptjs');

async function createAdminWithPrisma() {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    await prisma.$connect();
    console.log('✅ Connected to database via Prisma');

    // Check if admin exists
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@fleetflow.com' }
    });

    if (adminUser) {
      console.log('✅ Admin user already exists');
      console.log(`   Email: ${adminUser.email}`);
      console.log(`   Role: ${adminUser.role}`);
      console.log(`   Verified: ${adminUser.emailVerified ? 'Yes' : 'No'}`);

      // Check password
      const validPassword = await bcrypt.compare('admin123', adminUser.password);
      console.log(`   Password "admin123" valid: ${validPassword ? '✅ YES' : '❌ NO'}`);

      if (!validPassword) {
        console.log('🔄 Updating admin password...');
        const newHash = await bcrypt.hash('admin123', 12);
        await prisma.user.update({
          where: { id: adminUser.id },
          data: { password: newHash, emailVerified: new Date() }
        });
        console.log('✅ Admin password updated and verified!');
      } else if (!adminUser.emailVerified) {
        console.log('🔄 Verifying admin email...');
        await prisma.user.update({
          where: { id: adminUser.id },
          data: { emailVerified: new Date() }
        });
        console.log('✅ Admin email verified!');
      }
    } else {
      console.log('👤 Creating admin user...');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      const admin = await prisma.user.create({
        data: {
          name: 'Admin User',
          email: 'admin@fleetflow.com',
          password: hashedPassword,
          role: 'admin',
          company: 'FleetFlow',
          emailVerified: new Date(),
        }
      });
      console.log('✅ Admin user created!');
      console.log(`   Email: ${admin.email}`);
      console.log(`   Password: admin123`);
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
    console.log('   1. Check DATABASE_URL is set correctly');
    console.log('   2. Check PostgreSQL is running and accessible');
    console.log('   3. Run "npx prisma db push" to create tables');
    process.exit(1);
  }

  console.log('\n🎉 Admin user setup complete!');
  console.log('   Login at: https://fleet.ashbi.ca/auth/login');
  console.log('   Email: admin@fleetflow.com');
  console.log('   Password: admin123');
}

main().catch(console.error);
