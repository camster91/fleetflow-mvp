import type { NextApiRequest, NextApiResponse } from 'next'
import { getUserFromRequest } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

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
