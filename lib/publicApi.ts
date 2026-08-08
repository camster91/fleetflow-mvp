import type { NextApiRequest, NextApiResponse } from 'next'
import { apiError } from './apiAuth'
import { constantTimeCompare } from './tokens'
import crypto from 'crypto'

export const PUBLIC_API_DEFAULT_LIMIT = 25
export const PUBLIC_API_MAX_LIMIT = 100

export function requireGet(req: NextApiRequest, res: NextApiResponse): boolean {
  if (req.method === 'GET') return true
  res.setHeader('Allow', 'GET')
  apiError(res, 405, 'METHOD_NOT_ALLOWED', 'This endpoint supports GET only')
  return false
}

type ApiResourceWhere = { teamId: string } | { ownerId: string; teamId: null }

export function resolveApiCursorSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.API_CURSOR_SECRET || env.NEXTAUTH_SECRET || env.JWT_SECRET
  if (secret) {
    if (env.NODE_ENV === 'production' && secret.length < 32) {
      throw new Error('API cursor signing secret must be at least 32 characters')
    }
    return secret
  }
  if (env.NODE_ENV === 'production') throw new Error('API_CURSOR_SECRET is required')
  return 'fleetvera-development-cursor-secret'
}

function cursorTenant(where: ApiResourceWhere): string {
  return 'ownerId' in where ? `personal:${where.ownerId}` : `team:${where.teamId}`
}

export function createPublicApiCursor(endpoint: string, where: ApiResourceWhere, lastId: string): string {
  const encoded = Buffer.from(JSON.stringify({ v: 1, endpoint, tenant: cursorTenant(where), lastId })).toString('base64url')
  const signature = crypto.createHmac('sha256', resolveApiCursorSecret()).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

export function readPublicApiCursor(cursor: string, endpoint: string, where: ApiResourceWhere): string | null {
  try {
    const parts = cursor.split('.')
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null
    const expected = crypto.createHmac('sha256', resolveApiCursorSecret()).update(parts[0]).digest('base64url')
    if (!constantTimeCompare(parts[1], expected)) return null
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    if (payload?.v !== 1 || payload.endpoint !== endpoint || payload.tenant !== cursorTenant(where) || typeof payload.lastId !== 'string' || !payload.lastId) return null
    return payload.lastId
  } catch {
    return null
  }
}

export function parseCursorPagination(
  req: NextApiRequest,
  res: NextApiResponse,
  endpoint: string,
  where: ApiResourceWhere
) {
  try {
    resolveApiCursorSecret()
  } catch {
    apiError(res, 503, 'CURSOR_UNAVAILABLE', 'Pagination security is not configured')
    return null
  }
  const rawLimit = req.query.limit
  const rawCursor = req.query.cursor
  if (Array.isArray(rawLimit) || Array.isArray(rawCursor)) {
    apiError(res, 400, 'INVALID_PAGINATION', 'limit and cursor must each be a single value')
    return null
  }

  const limit = rawLimit === undefined ? PUBLIC_API_DEFAULT_LIMIT : Number(rawLimit)
  if (!Number.isInteger(limit) || limit < 1) {
    apiError(res, 400, 'INVALID_PAGINATION', 'limit must be a positive integer')
    return null
  }

  let cursor: string | undefined
  if (rawCursor !== undefined) {
    cursor = readPublicApiCursor(rawCursor, endpoint, where) || undefined
    if (!cursor) {
      apiError(res, 400, 'INVALID_PAGINATION', 'cursor is malformed, expired, or belongs to another resource')
      return null
    }
  }
  return { limit: Math.min(limit, PUBLIC_API_MAX_LIMIT), cursor }
}

export function cursorQuery(pagination: { limit: number; cursor?: string }) {
  return {
    orderBy: { id: 'asc' as const },
    take: pagination.limit + 1,
    ...(pagination.cursor ? { cursor: { id: pagination.cursor }, skip: 1 } : {}),
  }
}

export function sendCursorPage<T extends { id: string }>(
  res: NextApiResponse,
  rows: T[],
  limit: number,
  endpoint: string,
  where: ApiResourceWhere
) {
  const hasMore = rows.length > limit
  const data = hasMore ? rows.slice(0, limit) : rows
  return res.status(200).json({
    data,
    pagination: { limit, nextCursor: hasMore ? createPublicApiCursor(endpoint, where, data[data.length - 1].id) : null },
  })
}

export function sendPublicApiFailure(res: NextApiResponse) {
  console.error('Public API read failed')
  return apiError(res, 500, 'INTERNAL_ERROR', 'The request could not be completed')
}
