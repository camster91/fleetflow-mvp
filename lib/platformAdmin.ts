import type { NextApiRequest, NextApiResponse } from 'next'
import { assertSameOrigin, requireTenantContext } from '@/lib/apiAuth'
import { rateLimitMiddleware } from '@/lib/rateLimit'

export type PlatformAdminContext = NonNullable<Awaited<ReturnType<typeof requireTenantContext>>>

/**
 * Guard for deployment-wide admin endpoints: allowed methods, same-origin writes, a platform admin
 * session (team ownership never grants access) and the admin rate limit. Returns null once it has
 * responded.
 */
export async function requirePlatformAdmin(
  req: NextApiRequest,
  res: NextApiResponse,
  { methods, rateKey }: { methods: string[]; rateKey: string }
): Promise<PlatformAdminContext | null> {
  if (!methods.includes(req.method ?? '')) {
    res.setHeader('Allow', methods.join(', '))
    res.status(405).json({ error: 'Method not allowed' })
    return null
  }
  if (req.method !== 'GET' && !assertSameOrigin(req, res)) return null
  const context = await requireTenantContext(req, res)
  if (!context) return null
  if (context.session.user.role !== 'admin') {
    res.status(403).json({ error: 'Platform administrator access is required' })
    return null
  }
  if (!(await rateLimitMiddleware(req, res, 'admin', `${rateKey}:${context.session.user.id}`))) return null
  return context
}
