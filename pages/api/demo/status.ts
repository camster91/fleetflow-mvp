import type { NextApiRequest, NextApiResponse } from 'next'
import { demoEnabled } from '@/lib/demo/policy'
import { currentDemoSession } from '@/lib/demo/sessions'
import { getUserFromRequest } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!demoEnabled()) return res.json({ enabled: false })
  try {
    const demo = await currentDemoSession(req)
    const session = demo ? await getUserFromRequest(req) : null
    return res.json({ enabled: true, active: !!demo, role: session?.user.role, expiresAt: demo?.expiresAt })
  } catch {
    return res.status(503).json({ enabled: true, error: 'Demo unavailable' })
  }
}
