#!/usr/bin/env node

/** One-time bootstrap for a brand-new database. Login remains passwordless. */
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const name = process.env.ADMIN_NAME?.trim() || 'FleetFlow Admin'
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Set ADMIN_EMAIL to a valid administrator email address.')
  }
  if (process.env.CONFIRM_ADMIN_BOOTSTRAP !== 'yes') {
    throw new Error('Set CONFIRM_ADMIN_BOOTSTRAP=yes to confirm this one-time operation.')
  }

  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()
  try {
    const userCount = await prisma.user.count()
    if (userCount !== 0) {
      throw new Error('Bootstrap refused: the database already contains users.')
    }
    await prisma.user.create({
      data: { email, name, role: 'admin', emailVerified: new Date(), onboardingCompleted: true },
    })
    console.log(`Administrator bootstrapped for ${email}. Use the emailed one-time code to sign in.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Administrator bootstrap failed.')
  process.exit(1)
})
