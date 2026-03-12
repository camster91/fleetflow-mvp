import type { NextApiRequest, NextApiResponse } from 'next'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Create Supabase client
    const supabase = createPagesServerClient({ req, res })
    
    // Get session
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error || !session) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    return res.status(200).json({ 
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.user_metadata?.name || session.user.email,
        role: session.user.user_metadata?.role || 'fleet_manager',
        company: session.user.user_metadata?.company,
      }
    })
  } catch (error: any) {
    return res.status(401).json({ error: error.message })
  }
}
