/**
 * Seed admin users: cameron@ashbi.ca and gerardo.actor@gmail.com
 * Run via: npx ts-node scripts/seed-admins.ts
 * Or in production: node -e "..." using Prisma directly
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ADMINS = [
  { email: 'cameron@ashbi.ca', name: 'Cameron', role: 'admin' },
  { email: 'gerardo.actor@gmail.com', name: 'Gerardo', role: 'admin' },
]

async function main() {
  for (const admin of ADMINS) {
    const existing = await prisma.user.findUnique({ where: { email: admin.email } })
    if (existing) {
      // Ensure role is admin
      if (existing.role !== 'admin') {
        await prisma.user.update({ where: { email: admin.email }, data: { role: 'admin' } })
        console.log(`Updated ${admin.email} to admin role`)
      } else {
        console.log(`${admin.email} already exists as admin`)
      }
    } else {
      await prisma.user.create({
        data: {
          email: admin.email,
          name: admin.name,
          role: 'admin',
          emailVerified: new Date(),
          onboardingCompleted: true,
          onboardingStep: 99,
        },
      })
      console.log(`Created admin: ${admin.email}`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
