import { prisma } from '../lib/prisma'
import bcrypt from 'bcryptjs'

async function main() {
  console.log('Seeding database with demo users...')

  // Check if users already exist
  const existingUsers = await prisma.user.count()
  if (existingUsers > 0) {
    console.log('Users already exist, skipping seed...')
    return
  }

  const demoUsers = [
    {
      email: 'admin@fleetflow.com',
      name: 'System Administrator',
      password: 'demo123',
      role: 'admin' as const,
      company: 'FleetFlow Inc.',
    },
    {
      email: 'manager@fleetflow.com',
      name: 'John Fleetman',
      password: 'demo123',
      role: 'fleet_manager' as const,
      company: 'Joseph\'s Food Truck Delivery',
    },
    {
      email: 'dispatch@fleetflow.com',
      name: 'Sarah Dispatcher',
      password: 'demo123',
      role: 'dispatch' as const,
      company: 'Joseph\'s Food Truck Delivery',
    },
    {
      email: 'driver@fleetflow.com',
      name: 'Mike Driver',
      password: 'demo123',
      role: 'driver' as const,
      company: 'Joseph\'s Food Truck Delivery',
    },
    {
      email: 'maintenance@fleetflow.com',
      name: 'Alex Technician',
      password: 'demo123',
      role: 'maintenance' as const,
      company: 'Joseph\'s Food Truck Delivery',
    },
    {
      email: 'safety@fleetflow.com',
      name: 'Pat Safety',
      password: 'demo123',
      role: 'safety_officer' as const,
      company: 'Joseph\'s Food Truck Delivery',
    },
    {
      email: 'finance@fleetflow.com',
      name: 'Taylor Finance',
      password: 'demo123',
      role: 'finance' as const,
      company: 'Joseph\'s Food Truck Delivery',
    },
  ]

  for (const userData of demoUsers) {
    const hashedPassword = await bcrypt.hash(userData.password, 12)
    
    await prisma.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        password: hashedPassword,
        role: userData.role,
        company: userData.company,
      },
    })

    console.log(`Created user: ${userData.email} (${userData.role})`)
  }

  console.log('Database seeding completed!')
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })