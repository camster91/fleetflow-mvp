import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create admin user
  const hashedPassword = await bcrypt.hash('Admin@123!', 12)
  const user = await prisma.user.upsert({
    where: { email: 'admin@fleetflow.test' },
    update: {},
    create: {
      email: 'admin@fleetflow.test',
      name: 'Admin User',
      password: hashedPassword,
      role: 'fleet_manager',
      company: 'FleetFlow Demo',
      emailVerified: new Date(),
      onboardingCompleted: true,
    },
  })
  console.log(`✓ Admin user: ${user.email}`)

  // Sample vehicle
  await prisma.vehicle.upsert({
    where: { id: 'seed-vehicle-1' },
    update: {},
    create: {
      id: 'seed-vehicle-1',
      name: 'Van 1',
      status: 'active',
      driver: 'John Smith',
      location: 'Downtown Depot',
      eta: '2:00 PM',
      mileage: 15000,
      maintenanceDue: false,
      ownerId: user.id,
    },
  })
  console.log('✓ Sample vehicle created')

  // Sample SOP category
  await prisma.sOPCategory.upsert({
    where: { id: 'seed-sop-1' },
    update: {},
    create: {
      id: 'seed-sop-1',
      name: 'Safety Procedures',
      description: 'Vehicle safety and emergency procedures',
      documentCount: 0,
      ownerId: user.id,
    },
  })
  console.log('✓ Sample SOP category created')

  console.log('Seeding complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
