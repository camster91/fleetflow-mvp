import type { NextApiRequest, NextApiResponse } from 'next'
import { assertSameOrigin } from '../../../lib/apiAuth'
import { clearAuthenticationCookies } from '../../../lib/authCookies'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!assertSameOrigin(req, res)) return

  res.setHeader('Set-Cookie', clearAuthenticationCookies())
  res.setHeader('Cache-Control', 'private, no-store')
  return res.json({ ok: true })
}
