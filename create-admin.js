#!/usr/bin/env node

/**
 * Root create-admin entrypoint.
 * Requires ADMIN_PASSWORD — never embeds default credentials.
 *
 *   ADMIN_PASSWORD='your-strong-password' node create-admin.js
 */

const bcrypt = require('bcryptjs');

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@fleetflow.com';
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || adminPassword.length < 12) {
    console.error('❌ Set ADMIN_PASSWORD (min 12 characters) before running this script.');
    process.exit(1);
  }

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { password: hashedPassword, emailVerified: new Date(), role: 'admin' },
      });
      console.log('✅ Admin password rotated for', adminEmail);
    } else {
      await prisma.user.create({
        data: {
          name: 'Admin User',
          email: adminEmail,
          password: hashedPassword,
          role: 'admin',
          company: 'FleetFlow',
          emailVerified: new Date(),
        },
      });
      console.log('✅ Admin created:', adminEmail);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
