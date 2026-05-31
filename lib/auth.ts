import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import type { NextApiRequest, NextApiResponse } from 'next'
import { parse } from 'cookie'

const JWT_SECRET=process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is not set')
  }
  return 'dev-only-placeholder-not-for-production'
})()

export interface TokenPayload {
  sub: string
  email: string
  name: string | null
  role: string
  iat?: number
}

export interface SessionUser {
  id: string
  email: string
  name: string | null
  role: string
  onboardingCompleted?: boolean
}

export interface Session {
  user: SessionUser
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function signToken(payload: Omit<TokenPayload, 'iat'>, expiresIn = '7d'): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn })
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET as string) as TokenPayload
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
  if (!payload?.sub) return null

  // Check if password was changed after token was issued (invalidate old tokens)
  const dbUser = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { passwordChangedAt: true, role: true, email: true, name: true, onboardingCompleted: true },
  })

  if (!dbUser) return null

  if (dbUser.passwordChangedAt && payload.iat) {
    const changedAt = new Date(dbUser.passwordChangedAt).getTime() / 1000
    if (changedAt > payload.iat) return null
  }

  return {
    user: {
      id: payload.sub,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      onboardingCompleted: dbUser.onboardingCompleted,
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
  _options?: any
): Promise<Session | null> {
  return getUserFromRequest(req)
}

/** Kept for backwards compatibility with imports referencing authOptions */
export const authOptions = {}
