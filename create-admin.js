const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createAdmin() {
  try {
    console.log('🔧 Creating admin user...');
    
    // Check if admin already exists
    let admin = await prisma.user.findUnique({
      where: { email: 'admin@fleetflow.com' }
    });
    
    if (!admin) {
      // Create admin
      const hashedPassword = await bcrypt.hash('admin123', 12);
      admin = await prisma.user.create({
        data: {
          name: 'Admin User',
          email: 'admin@fleetflow.com',
          password: hashedPassword,
          role: 'admin',
          company: 'FleetFlow',
          emailVerified: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        },
      });
      console.log('✅ Admin user created');
    } else if (!admin.emailVerified) {
      // Verify existing admin
      await prisma.user.update({
        where: { id: admin.id },
        data: { emailVerified: new Date() }
      });
      console.log('✅ Admin user verified');
    } else {
      console.log('✅ Admin user already exists and verified');
    }
    
    // Verify ALL existing users (bypass email verification)
    const unverifiedUsers = await prisma.user.findMany({
      where: { emailVerified: null }
    });
    
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
    
    console.log('\n🎉 Auth setup complete!');
    console.log('🔑 Login credentials:');
    console.log('   Email: admin@fleetflow.com');
    console.log('   Password: admin123');
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createAdmin();