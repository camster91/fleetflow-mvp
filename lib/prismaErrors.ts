import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * Maps known Prisma request errors to client-safe HTTP responses so a foreign
 * key restriction, missing row or unique conflict never surfaces as a raw 500.
 * See docs/data-deletion-policy.md for which deletes are restricted.
 */

export interface PrismaErrorMessages {
  /** P2003: a foreign key blocks the write, e.g. dependent records still exist. */
  foreignKey?: string
  /** P2025: the record to update or delete no longer exists. */
  notFound?: string
  /** P2002: a unique constraint would be violated. */
  unique?: string
}

export interface MappedPrismaError {
  status: 404 | 409
  code: 'P2002' | 'P2003' | 'P2025'
  error: string
}

const DEFAULT_MESSAGES: Required<PrismaErrorMessages> = {
  foreignKey: 'This record is still referenced by other records. Remove or archive those first.',
  notFound: 'Not found',
  unique: 'A record with these details already exists.',
}

function prismaErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' && /^P\d{4}$/.test(code) ? code : null
}

export function mapPrismaError(error: unknown, messages: PrismaErrorMessages = {}): MappedPrismaError | null {
  const text = { ...DEFAULT_MESSAGES, ...messages }
  switch (prismaErrorCode(error)) {
    case 'P2003':
      return { status: 409, code: 'P2003', error: text.foreignKey }
    case 'P2025':
      return { status: 404, code: 'P2025', error: text.notFound }
    case 'P2002':
      return { status: 409, code: 'P2002', error: text.unique }
    default:
      return null
  }
}

/** Sends the mapped response and returns true, or returns false for any other error. */
export function sendPrismaError(res: NextApiResponse, error: unknown, messages?: PrismaErrorMessages): boolean {
  const mapped = mapPrismaError(error, messages)
  if (!mapped || res.headersSent) return false
  res.status(mapped.status).json({ error: mapped.error, code: mapped.code })
  return true
}

/**
 * Wraps an API route so known Prisma errors become 404/409 responses. Any
 * other error is rethrown unchanged.
 */
export function withPrismaErrors<T extends NextApiResponse>(
  handler: (req: NextApiRequest, res: T) => unknown | Promise<unknown>,
  messages?: PrismaErrorMessages
) {
  return async function prismaErrorHandler(req: NextApiRequest, res: T) {
    try {
      return await handler(req, res)
    } catch (error) {
      if (sendPrismaError(res, error, messages)) return
      throw error
    }
  }
}
