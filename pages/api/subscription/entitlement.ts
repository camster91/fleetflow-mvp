import type { NextApiRequest, NextApiResponse } from 'next'
import { requireTenantContext } from '../../../lib/apiAuth'
import { canManageBilling } from '../../../lib/permissions'
import { rateLimitMiddleware } from '../../../lib/rateLimit'
import { getWorkspaceEntitlement, serializeEntitlement } from '../../../lib/entitlements'

/**
 * GET: the selected workspace's plan access (full or read-only, and why), for every member so the
 * dashboard can explain a read-only workspace. Only billing managers are offered the billing action.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const context = await requireTenantContext(req, res)
  if (!context) return
  if (!(await rateLimitMiddleware(req, res, 'api', `entitlement:${context.session.user.id}`))) return

  const entitlement = await getWorkspaceEntitlement(context.tenant.ownerId)
  res.setHeader('Cache-Control', 'private, no-store')
  return res.status(200).json({
    entitlement: serializeEntitlement(entitlement),
    canManageBilling: canManageBilling(context.tenant.role),
  })
}
