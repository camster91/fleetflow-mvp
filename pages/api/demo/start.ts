import type { NextApiRequest, NextApiResponse } from 'next'
import { assertSameOrigin } from '@/lib/apiAuth'
import { demoEnabled } from '@/lib/demo/policy'
import { rateLimitMiddleware } from '@/lib/rateLimit'
import { createDemoSession, currentDemoSession, demoError, enterDemo } from '@/lib/demo/sessions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!demoEnabled()) return res.status(404).json({ error: 'Not found' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use the demo entry button' })
  if (!assertSameOrigin(req, res) || !(await rateLimitMiddleware(req, res, 'api'))) return
  try {
    const demo = (await currentDemoSession(req)) || (await createDemoSession(req))
    await enterDemo(res, demo)
    return res.json({ ok: true })
  } catch (error) {
    return demoError(res, error)
  }
}
