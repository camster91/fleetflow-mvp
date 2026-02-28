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

  // POST - Start impersonating a user
  if (req.method === 'POST') {
    const { userId } = req.body
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' })
    }
    
    try {
      // Get the user to impersonate
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          company: true
        }
      })
      
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' })
      }
      
      // Prevent impersonating another admin (security measure)
      if (targetUser.role === 'admin' && userId !== session.user.id) {
        return res.status(403).json({ error: 'Cannot impersonate another admin' })
      }
      
      // Store impersonation data in session
      // Note: In a real implementation, you'd use a custom session strategy
      // For now, we return the impersonation token that the frontend will store
      const impersonationData = {
        isImpersonating: true,
        originalUserId: session.user.id,
        originalUserRole: session.user.role,
        impersonatedUserId: targetUser.id,
        impersonatedUserRole: targetUser.role,
        impersonatedUserName: targetUser.name,
        impersonatedUserEmail: targetUser.email,
        startedAt: new Date().toISOString()
      }
      
      return res.status(200).json({ 
        success: true,
        impersonation: impersonationData,
        targetUser
      })
    } catch (error) {
      console.error('Error starting impersonation:', error)
      return res.status(500).json({ error: 'Failed to start impersonation' })
    }
  }

  // DELETE - Stop impersonating
  if (req.method === 'DELETE') {
    return res.status(200).json({ 
      success: true,
      message: 'Impersonation ended'
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
