import type { NextApiRequest, NextApiResponse } from 'next'
import { getUserFromRequest } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { assertSameOrigin } from '../../../lib/apiAuth'
import { clearAuthenticationCookies } from '../../../lib/authCookies'

/**
 * "Log out everywhere": bump User.tokenVersion so every session JWT issued so
 * far (on any device) is rejected by getUserFromRequest, then clear this
 * browser's cookies.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  res.setHeader('Cache-Control', 'private, no-store')
  if (!assertSameOrigin(req, res)) return

  const session = await getUserFromRequest(req)
  if (!session) {
    res.setHeader('Set-Cookie', clearAuthenticationCookies())
    return res.status(401).json({ error: 'Unauthorized' })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { tokenVersion: { increment: 1 } },
  })

  res.setHeader('Set-Cookie', clearAuthenticationCookies())
  return res.json({ ok: true })
}
