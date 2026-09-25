import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { constantTimeCompare, generateAPIKey, hashToken } from '../../../lib/tokens'
import { requireSession, requireTenantContext, assertSameOrigin } from '../../../lib/apiAuth'
import { canAccessApi } from '../../../lib/permissions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Revoking your own key only ever reduces access, so it stays available
  // even after a role downgrade. Listing and creating keys require API access.
  let userId: string
  if (req.method === 'DELETE') {
    const session = await requireSession(req, res)
    if (!session) return
    userId = session.user.id
  } else {
    const context = await requireTenantContext(req, res)
    if (!context) return
    if (!canAccessApi(context.tenant.role)) {
      return res.status(403).json({ error: 'Your workspace role does not permit API access' })
    }
    userId = context.session.user.id
  }

  switch (req.method) {
    case 'GET':
      try {
        const keys = await prisma.apiKey.findMany({
          where: {
            userId,
            revokedAt: null,
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: {
            id: true,
            name: true,
            key: true,
            scopes: true,
            createdAt: true,
            lastUsedAt: true,
          },
        })

        // Keys are stored hashed — never return recoverable secrets
        const maskedKeys = keys.map((k) => ({
          id: k.id,
          name: k.name,
          scopes: k.scopes.split(/[\s,]+/).filter(Boolean),
          key: 'ff_••••••••••••••••',
          createdAt: k.createdAt,
          lastUsedAt: k.lastUsedAt,
        }))

        return res.status(200).json({ keys: maskedKeys })
      } catch (error) {
        console.error('Failed to fetch API keys:', error)
        return res.status(500).json({ error: 'Failed to fetch API keys' })
      }

    case 'POST': {
      if (!assertSameOrigin(req, res)) return
      try {
        const { name } = req.body || {}

        if (!name || typeof name !== 'string' || name.trim().length < 1 || name.length > 100) {
          return res.status(400).json({ error: 'Name is required' })
        }

        const { key, hashedKey } = generateAPIKey()

        const apiKey = await prisma.apiKey.create({
          data: {
            userId,
            name: name.trim(),
            key: hashedKey, // store hash only
            scopes: 'read',
          },
          select: {
            id: true,
            name: true,
            createdAt: true,
          },
        })

        // Return plaintext key once at creation time only
        return res.status(201).json({
          apiKey: {
            ...apiKey,
            key,
            scopes: ['read'],
          },
        })
      } catch (error) {
        console.error('Failed to create API key:', error)
        return res.status(500).json({ error: 'Failed to create API key' })
      }
    }

    case 'DELETE': {
      if (!assertSameOrigin(req, res)) return
      try {
        const { id } = req.query

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'API key ID is required' })
        }

        const result = await prisma.apiKey.updateMany({
          where: {
            id,
            userId,
          },
          data: {
            revokedAt: new Date(),
          },
        })

        if (result.count === 0) {
          return res.status(404).json({ error: 'API key not found' })
        }

        return res.status(200).json({ success: true })
      } catch (error) {
        console.error('Failed to revoke API key:', error)
        return res.status(500).json({ error: 'Failed to revoke API key' })
      }
    }

    default:
      return res.status(405).json({ error: 'Method not allowed' })
  }
}

/** Verify a presented API key against hashed storage (for future API auth). */
export function verifyStoredApiKey(presented: string, storedHash: string): boolean {
  return constantTimeCompare(hashToken(presented), storedHash)
}
