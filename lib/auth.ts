import jwt from 'jsonwebtoken'
import type { SignOptions } from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import type { NextApiRequest, NextApiResponse } from 'next'
import { parse } from 'cookie'

function getJwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim()
  if (configured && (process.env.NODE_ENV !== 'production' || configured.length >= 32)) {
    return configured
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured with at least 32 characters')
  }
  return configured || 'dev-only-placeholder-not-for-production'
}

export interface TokenPayload {
  sub: string
  email: string
  name: string | null
  role: string
  purpose?: 'session' | 'two-factor'
  /** User.tokenVersion at issue time. Tokens issued before this claim existed count as 0. */
  tv?: number
  iat?: number
  exp?: number
}

export interface SessionUser {
  id: string
  email: string
  name: string | null
  role: string
  onboardingCompleted?: boolean
  tokenVersion?: number
}

export interface Session {
  user: SessionUser
  expires?: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function signToken(
  payload: Omit<TokenPayload, 'iat'>,
  expiresIn: SignOptions['expiresIn'] = '7d'
): string {
  return jwt.sign({ purpose: 'session', ...payload }, getJwtSecret(), { expiresIn })
}

/**
 * Token version carried by a verified payload. Tokens signed before the claim
 * was introduced have no `tv` and are treated as version 0 so existing
 * sessions survive the deploy that adds revocation.
 */
export function tokenVersionOf(payload: Pick<TokenPayload, 'tv'>): number | null {
  if (payload.tv === undefined) return 0
  return Number.isInteger(payload.tv) && payload.tv >= 0 ? payload.tv : null
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as TokenPayload
  } catch {
    return null
  }
}

/**
 * Extract the authenticated user from an API request cookie.
 * Returns a session-shaped object compatible with the old NextAuth pattern:
 *   session.user.id / session.user.email / session.user.name / session.user.role
 * Returns null if not authenticated or token was invalidated by password change.
 */
export async function getUserFromRequest(req: NextApiRequest): Promise<Session | null> {
  const cookies = req.headers.cookie ? parse(req.headers.cookie) : {}
  const token = cookies.token
  if (!token) return null

  const payload = verifyToken(token)
  if (!payload?.sub || payload.purpose !== 'session') return null

  // Check if password was changed after token was issued (invalidate old tokens)
  const dbUser = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      passwordChangedAt: true,
      tokenVersion: true,
      role: true,
      email: true,
      name: true,
      onboardingCompleted: true,
    },
  })

  if (!dbUser) return null

  // "Log out everywhere" and 2FA changes bump tokenVersion to revoke old JWTs.
  if (tokenVersionOf(payload) !== (dbUser.tokenVersion ?? 0)) return null

  if (dbUser.passwordChangedAt && payload.iat) {
    const changedAt = new Date(dbUser.passwordChangedAt).getTime() / 1000
    if (changedAt > payload.iat) return null
  }

  return {
    expires: payload.exp ? new Date(payload.exp * 1000).toISOString() : undefined,
    user: {
      id: payload.sub,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      onboardingCompleted: dbUser.onboardingCompleted,
      tokenVersion: dbUser.tokenVersion ?? 0,
    },
  }
}

/**
 * Drop-in replacement for next-auth's getServerSession.
 * Uses our custom JWT cookie auth instead of NextAuth's session cookie.
 * Compatible signature: (req, res, options?) => Promise<Session | null>
 */
export async function getServerSession(
  req: NextApiRequest,
  _res?: NextApiResponse,
  _options?: unknown
): Promise<Session | null> {
  return getUserFromRequest(req)
}

/** Kept for backwards compatibility with imports referencing authOptions */
export const authOptions = {}
