import type { NextApiRequest } from 'next'
import { constantTimeCompare } from './tokens'

const MIN_CRON_SECRET_LENGTH = 32

/**
 * Authenticate a scheduled job using either the internal x-cron-secret header
 * or a strict Authorization: Bearer <secret> header.
 */
export function isAuthorizedCronRequest(req: NextApiRequest): boolean {
  const configured = process.env.CRON_SECRET
  if (!configured || configured.length < MIN_CRON_SECRET_LENGTH) return false

  const internalHeader = req.headers['x-cron-secret']
  if (Array.isArray(internalHeader)) return false

  const authorization = req.headers.authorization
  const bearerMatch = typeof authorization === 'string' ? /^Bearer ([^\s]+)$/i.exec(authorization) : null

  const presented = typeof internalHeader === 'string' ? internalHeader : bearerMatch?.[1]

  return typeof presented === 'string' && constantTimeCompare(presented, configured)
}
