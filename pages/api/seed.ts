import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../lib/prisma'
import bcrypt from 'bcryptjs'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../lib/auth'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // In development, allow unauthenticated seeding for initial setup
    // In production, require admin authentication
    if (process.env.NODE_ENV === 'production') {
      const session = await getServerSession(req, res, authOptions)
      
      if (!session) {
        return res.status(401).json({ error: 'Unauthorized' })
      }

      // Only admin can seed database
      if (session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin only' })
      }
    }

    console.log('Seeding database with demo users...')

    // Check if users already exist
    const existingUsers = await prisma.user.count()
    if (existingUsers > 0) {
      // Optional: delete existing users first
      // await prisma.user.deleteMany()
      // For now, just skip if users exist
      return res.status(200).json({ 
        message: 'Users already exist, skipping seed',
        existingCount: existingUsers 
      })
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
        email: 'manager@josephsdelivery.com',
        name: 'Joseph Chen',
        password: 'demo123',
        role: 'fleet_manager' as const,
        company: 'Joseph\'s Food Truck Delivery',
      },
      {
        email: 'dispatch@josephsdelivery.com',
        name: 'Sarah Johnson',
        password: 'demo123',
        role: 'dispatch' as const,
        company: 'Joseph\'s Food Truck Delivery',
      },
      {
        email: 'driver.mrodriguez@josephsdelivery.com',
        name: 'Michael Rodriguez',
        password: 'demo123',
        role: 'driver' as const,
        company: 'Joseph\'s Food Truck Delivery',
      },
      {
        email: 'driver.sjohnson@josephsdelivery.com',
        name: 'Sarah Johnson (Driver)',
        password: 'demo123',
        role: 'driver' as const,
        company: 'Joseph\'s Food Truck Delivery',
      },
      {
        email: 'driver.jwilson@josephsdelivery.com',
        name: 'James Wilson',
        password: 'demo123',
        role: 'driver' as const,
        company: 'Joseph\'s Food Truck Delivery',
      },
      {
        email: 'driver.rchen@josephsdelivery.com',
        name: 'Robert Chen',
        password: 'demo123',
        role: 'driver' as const,
        company: 'Joseph\'s Food Truck Delivery',
      },
      {
        email: 'driver.dmartinez@josephsdelivery.com',
        name: 'David Martinez',
        password: 'demo123',
        role: 'driver' as const,
        company: 'Joseph\'s Food Truck Delivery',
      },
      {
        email: 'driver.jlee@josephsdelivery.com',
        name: 'Jennifer Lee',
        password: 'demo123',
        role: 'driver' as const,
        company: 'Joseph\'s Food Truck Delivery',
      },
      {
        email: 'maintenance@josephsdelivery.com',
        name: 'Alex Technician',
        password: 'demo123',
        role: 'maintenance' as const,
        company: 'Joseph\'s Food Truck Delivery',
      },
      {
        email: 'safety@josephsdelivery.com',
        name: 'Pat Safety',
        password: 'demo123',
        role: 'safety_officer' as const,
        company: 'Joseph\'s Food Truck Delivery',
      },
      {
        email: 'finance@josephsdelivery.com',
        name: 'Taylor Finance',
        password: 'demo123',
        role: 'finance' as const,
        company: 'Joseph\'s Food Truck Delivery',
      },
    ]

    const createdUsers = []
    for (const userData of demoUsers) {
      const hashedPassword = await bcrypt.hash(userData.password, 12)
      
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          name: userData.name,
          password: hashedPassword,
          role: userData.role,
          company: userData.company,
        },
      })

      // Remove password from response
      const { password, ...userWithoutPassword } = user
      createdUsers.push(userWithoutPassword)
    }

    console.log(`Created ${createdUsers.length} demo users`)

    return res.status(200).json({
      message: 'Database seeded successfully',
      users: createdUsers,
    })
  } catch (error) {
    console.error('Error seeding database:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}