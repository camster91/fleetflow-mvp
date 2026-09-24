import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession, authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { assertSameOrigin } from '../../../lib/apiAuth'
import { rateLimit } from '../../../lib/security'
import { sendPrismaError } from '../../../lib/prismaErrors'

function requestMetadata(req: NextApiRequest) {
  const forwarded = req.headers['x-forwarded-for']
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim()
    || req.socket.remoteAddress
  return {
    ...(ip ? { ip } : {}),
    ...(req.headers['user-agent'] ? { userAgent: req.headers['user-agent'] } : {}),
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (['PATCH', 'DELETE'].includes(req.method || '') && !assertSameOrigin(req, res)) return

  const allowed = await rateLimit(req, res, 'admin')
  if (!allowed) return

  const session = await getServerSession(req, res, authOptions)

  if (!session || session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden - Admin access required' })
  }

  if (req.method === 'GET') {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1)
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50))
      const skip = (page - 1) * limit

      const [users, total] = await Promise.all([
        prisma.user.findMany({
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
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip,
          take: limit,
        }),
        prisma.user.count(),
      ])

      return res.status(200).json({ users, total, page, limit, hasMore: skip + limit < total })
    } catch (error) {
      console.error('Error fetching users:', error)
      return res.status(500).json({ error: 'Failed to fetch users' })
    }
  }

  if (req.method === 'PATCH') {
    const { userId, role } = req.body

    if (!userId || !role) {
      return res.status(400).json({ error: 'Missing userId or role' })
    }

    const validRoles = ['admin', 'fleet_manager', 'dispatch', 'driver', 'maintenance', 'safety_officer', 'finance', 'viewer']
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' })
    }

    if (userId === session.user.id && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot change your own role' })
    }

    try {
      const updatedUser = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id: userId },
          data: { role },
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        })
        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'USER_ROLE_CHANGED',
            entityType: 'user',
            entityId: userId,
            description: `USER_ROLE_CHANGED for user ${userId}`,
            metadata: JSON.stringify({ newRole: role, ...requestMetadata(req) }),
          },
        })
        return updated
      })

      return res.status(200).json({ user: updatedUser })
    } catch (error) {
      if (sendPrismaError(res, error, { notFound: 'User not found' })) return
      console.error('Error updating user role:', error)
      return res.status(500).json({ error: 'Failed to update user role' })
    }
  }

  if (req.method === 'DELETE') {
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' })
    }

    if (userId === session.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' })
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.user.delete({ where: { id: userId } })
        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'USER_DELETED',
            entityType: 'user',
            entityId: userId,
            description: `USER_DELETED for user ${userId}`,
            metadata: JSON.stringify(requestMetadata(req)),
          },
        })
      })

      return res.status(200).json({ success: true })
    } catch (error) {
      if (sendPrismaError(res, error, {
        notFound: 'User not found',
        foreignKey: 'This user still has records that must be kept, such as vehicle expense history or team records. Remove or reassign them first.',
      })) return
      console.error('Error deleting user:', error)
      return res.status(500).json({ error: 'Failed to delete user' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
