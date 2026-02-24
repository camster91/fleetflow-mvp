const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
require('dotenv').config()

const prisma = new PrismaClient({})

async function seed() {
  console.log('Seeding database with demo users...')

  try {
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
        role: 'admin',
        company: 'FleetFlow Inc.',
      },
      {
        email: 'manager@josephsdelivery.com',
        name: 'Joseph Chen',
        password: 'demo123',
        role: 'fleet_manager',
        company: 'Joseph\'s Food Truck Delivery',
      },
      {
        email: 'dispatch@josephsdelivery.com',
        name: 'Sarah Johnson',
        password: 'demo123',
        role: 'dispatch',
        company: 'Joseph\'s Food Truck Delivery',
      },
      {
        email: 'driver.mrodriguez@josephsdelivery.com',
        name: 'Michael Rodriguez',
        password: 'demo123',
        role: 'driver',
        company: 'Joseph\'s Food Truck Delivery',
      },
      {
        email: 'driver.sjohnson@josephsdelivery.com',
        name: 'Sarah Johnson (Driver)',
        password: 'demo123',
        role: 'driver',
        company: 'Joseph\'s Food Truck Delivery',
      },
      {
        email: 'driver.jwilson@josephsdelivery.com',
        name: 'James Wilson',
        password: 'demo123',
        role: 'driver',
        company: 'Joseph\'s Food Truck Delivery',
      },
      {
        email: 'driver.rchen@josephsdelivery.com',
        name: 'Robert Chen',
        password: 'demo123',
        role: 'driver',
        company: 'Joseph\'s Food Truck Delivery',
      },
      {
        email: 'maintenance@josephsdelivery.com',
        name: 'Alex Technician',
        password: 'demo123',
        role: 'maintenance',
        company: 'Joseph\'s Food Truck Delivery',
      },
      {
        email: 'safety@josephsdelivery.com',
        name: 'Pat Safety',
        password: 'demo123',
        role: 'safety_officer',
        company: 'Joseph\'s Food Truck Delivery',
      },
      {
        email: 'finance@josephsdelivery.com',
        name: 'Taylor Finance',
        password: 'demo123',
        role: 'finance',
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
  } catch (error) {
    console.error('Error seeding database:', error)
    throw error
  }
}

// Export the seed function for Prisma
module.exports = { seed }

// Run seed if called directly
if (require.main === module) {
  seed()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}