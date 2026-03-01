import type { NextApiRequest, NextApiResponse } from 'next'
import { signUp, signIn } from '../../../lib/auth'
import { serialize } from 'cookie'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { action, email, password, name } = req.body

  try {
    if (action === 'register') {
      const { user } = await signUp(email, password, name)
      return res.status(200).json({ success: true, user })
    }

    if (action === 'login') {
      const { user, access_token, refresh_token } = await signIn(email, password)
      
      // Set cookies
      res.setHeader('Set-Cookie', [
        serialize('access_token', access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          path: '/'
        }),
        serialize('refresh_token', refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30, // 30 days
          path: '/'
        })
      ])

      return res.status(200).json({ success: true, user })
    }

    return res.status(400).json({ error: 'Invalid action' })
  } catch (error: any) {
    return res.status(401).json({ error: error.message })
  }
}
