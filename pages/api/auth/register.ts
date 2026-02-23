import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import bcrypt from 'bcryptjs'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { name, email, password, company, role } = req.body

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        company: company || null,
        role: role || 'fleet_manager',
      },
    })

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user

    return res.status(201).json({
      message: 'User created successfully',
      user: userWithoutPassword,
    })
  } catch (error) {
    console.error('Registration error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}