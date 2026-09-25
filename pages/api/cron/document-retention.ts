import type { NextApiRequest, NextApiResponse } from 'next'
import path from 'path'
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isAuthorizedCronRequest } from '@/lib/cronAuth'
import { storageFromEnv } from '@/lib/documents/storage'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!isAuthorizedCronRequest(req)) return res.status(401).json({ error: 'Unauthorized' })
  const configured = process.env.DOCUMENT_STORAGE_PATH
  if (!configured && process.env.NODE_ENV === 'production')
    return res.status(503).json({ error: 'Document storage is not configured' })
  const storage = storageFromEnv({
    ...process.env,
    DOCUMENT_STORAGE_PATH: configured || path.join(process.cwd(), '.private-documents'),
  })
  const now = new Date()
  const candidates = await prisma.documentUpload.findMany({
    where: { expiresAt: { lte: now }, deletedAt: null, status: { not: 'DELETING' } },
    take: 100,
    orderBy: { expiresAt: 'asc' },
  })
  let deleted = 0
  for (const candidate of candidates) {
    const token = randomUUID()
    const claim = await prisma
      .$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT 1 AS acquired FROM (SELECT pg_advisory_xact_lock(hashtextextended(${candidate.scopeKey}, 0))) AS document_lock`
          const changed = await tx.documentUpload.updateMany({
            where: {
              id: candidate.id,
              revision: candidate.revision,
              storageKey: candidate.storageKey,
              expiresAt: candidate.expiresAt,
              deletedAt: null,
              status: { not: 'DELETING' },
            },
            data: {
              status: 'DELETING',
              cleanupToken: token,
              cleanupClaimedAt: now,
              processingToken: null,
              processingLeaseUntil: null,
              revision: { increment: 1 },
            },
          })
          return changed.count === 1 ? candidate.revision + 1 : null
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code))
          return null
        throw error
      })
    if (!claim) continue
    const owned = await prisma.documentUpload.findFirst({
      where: {
        id: candidate.id,
        status: 'DELETING',
        cleanupToken: token,
        revision: claim,
        storageKey: candidate.storageKey,
        expiresAt: candidate.expiresAt,
        deletedAt: null,
      },
    })
    if (!owned) continue
    try {
      await storage.delete(owned.storageKey)
    } catch {
      continue
    }
    const finalized = await prisma.documentUpload.updateMany({
      where: {
        id: owned.id,
        status: 'DELETING',
        cleanupToken: token,
        revision: claim,
        storageKey: owned.storageKey,
        expiresAt: owned.expiresAt,
        deletedAt: null,
      },
      data: {
        deletedAt: now,
        status: 'EXPIRED',
        extraction: null,
        reviewDraft: null,
        cleanupToken: null,
        cleanupClaimedAt: null,
        revision: { increment: 1 },
      },
    })
    deleted += finalized.count
  }
  return res.status(200).json({ deleted })
}
