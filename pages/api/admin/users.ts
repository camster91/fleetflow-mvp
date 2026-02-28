import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  
  // Check if user is authenticated and is an admin
  if (!session || session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden - Admin access required' })
  }

  // GET - List all users
  if (req.method === 'GET') {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          company: true,
          createdAt: true,
          updatedAt: true,
          emailVerified: true
        },
        orderBy: { createdAt: 'desc' }
      })
      
      return res.status(200).json({ users })
    } catch (error) {
      console.error('Error fetching users:', error)
      return res.status(500).json({ error: 'Failed to fetch users' })
    }
  }

  // PATCH - Update user role
  if (req.method === 'PATCH') {
    const { userId, role } = req.body
    
    if (!userId || !role) {
      return res.status(400).json({ error: 'Missing userId or role' })
    }
    
    const validRoles = ['admin', 'fleet_manager', 'dispatch', 'driver', 'maintenance', 'safety_officer', 'finance', 'viewer']
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' })
    }
    
    try {
      // Prevent admin from demoting themselves
      if (userId === session.user.id && role !== 'admin') {
        return res.status(400).json({ error: 'Cannot change your own role' })
      }
      
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role },
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      })
      
      return res.status(200).json({ user: updatedUser })
    } catch (error) {
      console.error('Error updating user role:', error)
      return res.status(500).json({ error: 'Failed to update user role' })
    }
  }

  // DELETE - Delete user
  if (req.method === 'DELETE') {
    const { userId } = req.body
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' })
    }
    
    try {
      // Prevent admin from deleting themselves
      if (userId === session.user.id) {
        return res.status(400).json({ error: 'Cannot delete yourself' })
      }
      
      await prisma.user.delete({
        where: { id: userId }
      })
      
      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('Error deleting user:', error)
      return res.status(500).json({ error: 'Failed to delete user' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
