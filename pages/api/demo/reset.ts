import type { NextApiRequest, NextApiResponse } from 'next'
import { assertSameOrigin } from '@/lib/apiAuth'
import { demoEnabled } from '@/lib/demo/policy'
import { createDemoSession, currentDemoSession, demoError, enterDemo } from '@/lib/demo/sessions'
import { prisma } from '@/lib/prisma'
import { rateLimitMiddleware } from '@/lib/rateLimit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!demoEnabled()) return res.status(404).json({ error: 'Not found' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!assertSameOrigin(req, res) || !(await rateLimitMiddleware(req, res, 'api'))) return
  try {
    const old = await currentDemoSession(req)
    if (!old) return res.status(401).json({ error: 'Open a new demo to continue' })
    const demo = await createDemoSession(req)
    await enterDemo(res, demo)
    await prisma.demoSession.update({ where: { id: old.id }, data: { expiresAt: new Date(0) } })
    return res.json({ ok: true })
  } catch (error) {
    return demoError(res, error)
  }
}
