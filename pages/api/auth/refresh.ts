import type { NextApiRequest, NextApiResponse } from 'next'
import { getUserFromRequest, signToken } from '../../../lib/auth'
import { assertSameOrigin } from '../../../lib/apiAuth'
import { sessionCookie } from '../../../lib/authCookies'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  res.setHeader('Cache-Control', 'private, no-store')
  if (!assertSameOrigin(req, res)) return

  const session = await getUserFromRequest(req)
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { user } = session
  const token = await signToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tv: user.tokenVersion ?? 0,
  })

  res.setHeader('Set-Cookie', sessionCookie(token))

  return res.status(200).json({ ok: true })
}
