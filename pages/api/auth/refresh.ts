import type { NextApiRequest, NextApiResponse } from 'next'
import { serialize } from 'cookie'
import { getUserFromRequest, signToken } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getUserFromRequest(req)
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { user } = session
  const token = signToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })

  res.setHeader('Set-Cookie', serialize('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  }))

  return res.status(200).json({ ok: true })
}
