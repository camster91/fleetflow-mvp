import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../lib/auth'
import { sendEmail } from '../../services/emailService'
import { rateLimit, isValidEmail } from '../../lib/security'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Apply rate limiting (10 emails per minute)
  const allowed = await rateLimit(req, res, 'api')
  if (!allowed) return

  // Check authentication
  const session = await getServerSession(req, res, authOptions)
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { to, subject, html, text } = req.body

    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Validate email addresses
    const recipients = Array.isArray(to) ? to : [to]
    if (recipients.length > 100) {
      return res.status(400).json({ error: 'Too many recipients (max 100)' })
    }
    
    for (const email of recipients) {
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: `Invalid email address: ${email}` })
      }
    }

    // Validate content size (max 10MB)
    const contentSize = JSON.stringify({ html, text }).length
    if (contentSize > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'Email content too large (max 10MB)' })
    }

    // Validate subject length
    if (subject.length > 998) {
      return res.status(400).json({ error: 'Subject too long (max 998 characters)' })
    }

    const result = await sendEmail({ to, subject, html, text })

    if (result.success) {
      return res.status(200).json({ success: true, messageId: result.messageId })
    } else {
      return res.status(500).json({ error: result.error })
    }
  } catch (error) {
    console.error('Email API error:', error)
    return res.status(500).json({ error: 'Failed to send email' })
  }
}
