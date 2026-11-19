import type { NextApiRequest, NextApiResponse } from 'next'
import { assertSameOrigin } from '@/lib/apiAuth'
import { demoEnabled, DEMO_ROLES, type DemoRole } from '@/lib/demo/policy'
import { currentDemoSession, demoError, enterDemo } from '@/lib/demo/sessions'
import { rateLimitMiddleware } from '@/lib/rateLimit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!demoEnabled()) return res.status(404).json({ error: 'Not found' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!assertSameOrigin(req, res) || !(await rateLimitMiddleware(req, res, 'api'))) return
  if (!DEMO_ROLES.includes(req.body?.role)) return res.status(400).json({ error: 'Choose a demo role' })
  try {
    const demo = await currentDemoSession(req)
    if (!demo) return res.status(401).json({ error: 'Open a new demo to continue' })
    await enterDemo(res, demo, req.body.role as DemoRole)
    return res.json({ ok: true })
  } catch (error) {
    return demoError(res, error)
  }
}
