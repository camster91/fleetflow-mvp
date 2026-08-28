import type { NextApiRequest, NextApiResponse } from 'next'
import { getUserFromRequest } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { assertSameOrigin } from '../../../lib/apiAuth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  res.setHeader('Cache-Control', 'private, no-store')
  if (!assertSameOrigin(req, res)) return

  const session = await getUserFromRequest(req)
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { onboardingCompleted: true },
  })

  return res.json({ success: true })
}
