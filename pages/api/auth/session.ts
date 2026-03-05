import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = req.cookies.access_token

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    const session = await getSession(token)
    
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' })
    }

    return res.status(200).json({ user: session.user })
  } catch (error: any) {
    return res.status(401).json({ error: error.message })
  }
}
