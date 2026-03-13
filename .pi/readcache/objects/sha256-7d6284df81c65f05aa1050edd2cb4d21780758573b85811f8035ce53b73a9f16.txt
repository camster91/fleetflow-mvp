import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email } = req.body

  if (!email) {
    return res.status(400).json({ error: 'Email required' })
  }

  try {
    // List users to find the one with matching email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (listError) {
      throw listError
    }
    
    const user = users.find(u => u.email === email)
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    if (user.email_confirmed_at) {
      return res.status(200).json({ message: 'User already confirmed' })
    }
    
    // Update user to confirm email
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    )
    
    if (error) {
      throw error
    }
    
    return res.status(200).json({ message: 'Email confirmed successfully' })
    
  } catch (error: any) {
    console.error('Confirm email error:', error)
    return res.status(500).json({ error: error.message })
  }
}
