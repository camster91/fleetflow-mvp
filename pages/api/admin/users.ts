import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession, authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { assertSameOrigin } from '../../../lib/apiAuth'
import { rateLimit } from '../../../lib/security'
import { sendPrismaError } from '../../../lib/prismaErrors'
import { getClientIP } from '../../../lib/rateLimit'
import { sendAccountInvitationEmail } from '../../../lib/email'
import { emailSchema } from '../../../lib/validation'
import { z } from 'zod'

const inviteCustomerSchema = z
  .object({
    email: emailSchema,
    name: z.string().trim().max(120).optional(),
    company: z.string().trim().max(120).optional(),
  })
  .strict()

function requestMetadata(req: NextApiRequest) {
  // Audit metadata uses the same proxy-aware client address as rate limiting.
  const clientIP = getClientIP(req)
  const ip = clientIP === 'unknown' ? undefined : clientIP
  return {
    ...(ip ? { ip } : {}),
    ...(req.headers['user-agent'] ? { userAgent: req.headers['user-agent'] } : {}),
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (['POST', 'PATCH', 'DELETE'].includes(req.method || '') && !assertSameOrigin(req, res)) return

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
            emailVerified: true,
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

  // Invite a new customer: create their account (they own their personal workspace and can create a
  // team from it) and email them how to sign in. Accounts are otherwise only created by team invites.
  if (req.method === 'POST') {
    const parsed = inviteCustomerSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email address', field: 'email' })
    const email = parsed.data.email.toLowerCase()
    try {
      const created = await prisma.$transaction(async (tx) => {
        if (await tx.user.findUnique({ where: { email }, select: { id: true } })) return null
        const user = await tx.user.create({
          data: { email, name: parsed.data.name || null, company: parsed.data.company || null },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            company: true,
            createdAt: true,
            updatedAt: true,
            emailVerified: true,
          },
        })
        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'USER_INVITED',
            entityType: 'user',
            entityId: user.id,
            description: `USER_INVITED for user ${user.id}`,
            metadata: JSON.stringify(requestMetadata(req)),
          },
        })
        return user
      })
      if (!created) return res.status(409).json({ error: 'An account with this email already exists', field: 'email' })
      const inviter = session.user.name || session.user.email || 'The Fleetvera team'
      const sent = await sendAccountInvitationEmail(email, inviter).catch(() => ({ success: false }))
      return res.status(201).json({ user: created, emailSent: sent.success })
    } catch (error) {
      if (sendPrismaError(res, error, { unique: 'An account with this email already exists' })) return
      console.error('Error inviting customer:', error)
      return res.status(500).json({ error: 'Failed to invite customer' })
    }
  }

  if (req.method === 'PATCH') {
    const { userId, role } = req.body

    if (!userId || !role) {
      return res.status(400).json({ error: 'Missing userId or role' })
    }

    const validRoles = [
      'admin',
      'fleet_manager',
      'dispatch',
      'driver',
      'maintenance',
      'safety_officer',
      'finance',
      'viewer',
    ]
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
            role: true,
          },
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
      if (
        sendPrismaError(res, error, {
          notFound: 'User not found',
          foreignKey:
            'This user still has records that must be kept, such as vehicle expense history or team records. Remove or reassign them first.',
        })
      )
        return
      console.error('Error deleting user:', error)
      return res.status(500).json({ error: 'Failed to delete user' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
