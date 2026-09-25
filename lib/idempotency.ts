import { createHash } from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'

/**
 * Optional `Idempotency-Key` support for create endpoints.
 *
 * A client that retries the same submit sends the same key. The first
 * successful (2xx) response is stored in the same transaction as the created
 * row, so a retry replays that response instead of creating a duplicate. The
 * unique (scope, key) index makes a concurrent duplicate fail its insert and
 * roll back its create; that request then replays the winner's response.
 * Requests without the header behave exactly as before.
 */

export const IDEMPOTENCY_HEADER = 'idempotency-key'
export const IDEMPOTENCY_REPLAYED_HEADER = 'Idempotent-Replayed'
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/

export interface IdempotencyScope {
  /** Tenant scope: the team for team workspaces, otherwise the personal owner. */
  tenant: { ownerId: string; teamId: string | null }
  userId: string
  /** Method and route, e.g. `POST /api/deliveries`. */
  route: string
}

export interface IdempotentRequest {
  /** False when the response was already sent (invalid key, replay or conflict). */
  proceed: boolean
  /** Stores a 2xx response for replay. Call inside the create transaction. No-op without a key. */
  store(tx: Prisma.TransactionClient, statusCode: number, body: unknown): Promise<void>
  /**
   * `.catch` handler for the create transaction: when a concurrent request with
   * the same key won the race, replays its response and resolves to null.
   * Any other error is rethrown unchanged.
   */
  replayOnConflict(error: unknown): Promise<null>
}

type StoredKey = {
  userId: string
  route: string
  requestHash: string
  statusCode: number
  responseBody: Prisma.JsonValue
  expiresAt: Date
}

export function idempotencyScopeKey(tenant: { ownerId: string; teamId: string | null }): string {
  return tenant.teamId ? `team:${tenant.teamId}` : `owner:${tenant.ownerId}`
}

/** Serializes JSON with object keys sorted so logically equal bodies hash the same. */
export function canonicalJson(value: unknown): string {
  if (value === undefined) return 'null'
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (value instanceof Date) return JSON.stringify(value.toISOString())
  if (Array.isArray(value))
    return `[${value.map((item) => (item === undefined ? 'null' : canonicalJson(item))).join(',')}]`
  const entries = Object.keys(value as Record<string, unknown>)
    .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`)
  return `{${entries.join(',')}}`
}

export function idempotencyRequestHash(body: unknown): string {
  return createHash('sha256')
    .update(canonicalJson(body ?? null))
    .digest('hex')
}

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2002'
}

const noop: IdempotentRequest = {
  proceed: true,
  store: async () => undefined,
  replayOnConflict: async (error: unknown) => {
    throw error
  },
}

/**
 * Reads and validates the `Idempotency-Key` header, replaying a stored response
 * when one exists. Call after authentication and permission checks.
 */
export async function beginIdempotentRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  options: IdempotencyScope
): Promise<IdempotentRequest> {
  const raw = req.headers[IDEMPOTENCY_HEADER]
  if (raw === undefined) return noop
  const key = Array.isArray(raw) ? (raw.length === 1 ? raw[0] : '') : raw
  if (!KEY_PATTERN.test(key)) {
    res.status(400).json({ error: 'Idempotency-Key must be 8-128 characters of letters, digits, "-" or "_"' })
    return { ...noop, proceed: false }
  }

  const scope = idempotencyScopeKey(options.tenant)
  const requestHash = idempotencyRequestHash(req.body)
  const where = { scope_key: { scope, key } }

  // Returns true when a response was sent from the stored record.
  const respondFrom = (stored: StoredKey): boolean => {
    if (stored.userId !== options.userId || stored.route !== options.route || stored.requestHash !== requestHash) {
      res.status(422).json({ error: 'Idempotency-Key was already used for a different request' })
      return true
    }
    res.setHeader(IDEMPOTENCY_REPLAYED_HEADER, 'true')
    res.status(stored.statusCode).json(stored.responseBody)
    return true
  }

  const now = new Date()
  const existing = await prisma.idempotencyKey.findUnique({ where })
  if (existing && existing.expiresAt > now) {
    respondFrom(existing)
    return { ...noop, proceed: false }
  }
  // An expired key that the retention cron has not yet removed may be reused.
  if (existing) await prisma.idempotencyKey.deleteMany({ where: { scope, key, expiresAt: { lte: now } } })

  return {
    proceed: true,
    async store(tx, statusCode, body) {
      if (statusCode < 200 || statusCode >= 300) return
      const createdAt = new Date()
      await tx.idempotencyKey.create({
        data: {
          scope,
          key,
          userId: options.userId,
          route: options.route,
          requestHash,
          statusCode,
          // Round-trip through JSON so the replay matches what res.json() sends.
          responseBody: JSON.parse(JSON.stringify(body ?? null)) as Prisma.InputJsonValue,
          createdAt,
          expiresAt: new Date(createdAt.getTime() + IDEMPOTENCY_TTL_MS),
        },
      })
    },
    async replayOnConflict(error) {
      if (isUniqueViolation(error)) {
        const winner = await prisma.idempotencyKey.findUnique({ where })
        if (winner && respondFrom(winner)) return null
      }
      throw error
    },
  }
}

/** Removes expired idempotency records. Used by the retention cron. */
export async function deleteExpiredIdempotencyKeys(now = new Date()): Promise<number> {
  const result = await prisma.idempotencyKey.deleteMany({ where: { expiresAt: { lt: now } } })
  return result.count
}
