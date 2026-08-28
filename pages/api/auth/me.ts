import type { NextApiRequest, NextApiResponse } from 'next'
import { getUserFromRequest } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  res.setHeader('Cache-Control', 'private, no-store')
  const session = await getUserFromRequest(req)
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  return res.json({ user: session.user, expires: session.expires })
}
