import type { NextApiRequest, NextApiResponse } from 'next'
import { handleOAuthCallback } from '../../../lib/auth'
import { serialize } from 'cookie'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code } = req.query

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing code' })
  }

  try {
    const { user, access_token, refresh_token } = await handleOAuthCallback(code)

    // Set cookies
    res.setHeader('Set-Cookie', [
      serialize('access_token', access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/'
      }),
      serialize('refresh_token', refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/'
      })
    ])

    // Redirect to dashboard
    res.redirect('/dashboard')
  } catch (error: any) {
    console.error('OAuth callback error:', error)
    res.redirect('/auth/login?error=oauth_failed')
  }
}
