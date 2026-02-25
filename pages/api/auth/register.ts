import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import bcrypt from 'bcryptjs'

// Allowed roles for self-registration (admin cannot be self-assigned)
const ALLOWED_ROLES = ['fleet_manager', 'dispatch', 'driver', 'maintenance', 'safety_officer', 'finance'] as const
type AllowedRole = typeof ALLOWED_ROLES[number]

// Simple in-memory rate limiter: max 10 registration attempts per IP per 15 minutes
const registrationAttempts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = registrationAttempts.get(ip)
  if (!entry || now > entry.resetAt) {
    registrationAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

// Basic email format validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Rate limiting
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown'
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many registration attempts. Please try again later.' })
  }

  try {
    const { name, email, password, company, role } = req.body

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Validate name
    if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100) {
      return res.status(400).json({ error: 'Name must be between 1 and 100 characters' })
    }

    // Validate email format
    if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' })
    }

    // Validate password strength
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }

    // Validate role — must be from the allowed set; admin cannot be self-assigned
    const assignedRole: AllowedRole = ALLOWED_ROLES.includes(role) ? role : 'fleet_manager'

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase(),
        password: hashedPassword,
        company: company || null,
        role: assignedRole,
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
