import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import bcrypt from 'bcryptjs'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { action, email, password, name } = req.body

  try {
    if (action === 'register') {
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      })
      
      if (existingUser) {
        throw new Error('User already exists')
      }
      
      const hashedPassword = await bcrypt.hash(password, 12)
      
      const user = await prisma.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          password: hashedPassword,
          role: 'fleet_manager',
        }
      })
      
      return res.status(200).json({ success: true, user: { id: user.id, email: user.email } })
    }

    // Login is now handled by NextAuth (via /api/auth/callback/[...nextauth])
    return res.status(400).json({ error: 'Use /api/auth/signin for login' })
    
  } catch (error: any) {
    return res.status(401).json({ error: error.message })
  }
}
