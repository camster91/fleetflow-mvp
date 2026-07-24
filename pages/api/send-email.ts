import type { NextApiRequest, NextApiResponse } from 'next'
import { sendEmail } from '../../services/emailService'
import { rateLimit, isValidEmail } from '../../lib/security'
import { requireSession, assertSameOrigin } from '../../lib/apiAuth'

/**
 * Restricted email endpoint — authenticated users may only email themselves.
 * Arbitrary recipient/HTML open-relay abuse is blocked.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const allowed = await rateLimit(req, res, 'api')
  if (!allowed) return

  const session = await requireSession(req, res)
  if (!session) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!assertSameOrigin(req, res)) return

  try {
    const { to, subject, html, text } = req.body || {}

    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    if (typeof subject !== 'string' || typeof html !== 'string') {
      return res.status(400).json({ error: 'Invalid payload' })
    }

    const recipients = Array.isArray(to) ? to : [to]
    if (recipients.length !== 1) {
      return res.status(400).json({ error: 'Only a single recipient is allowed' })
    }

    const recipient = String(recipients[0]).toLowerCase().trim()
    if (!isValidEmail(recipient)) {
      return res.status(400).json({ error: 'Invalid email address' })
    }

    // Prevent open relay: only allow emailing the authenticated user
    if (recipient !== session.user.email.toLowerCase()) {
      return res.status(403).json({ error: 'You may only send email to your own address' })
    }

    const contentSize = JSON.stringify({ html, text }).length
    if (contentSize > 100 * 1024) {
      return res.status(400).json({ error: 'Email content too large (max 100KB)' })
    }

    if (subject.length > 200) {
      return res.status(400).json({ error: 'Subject too long (max 200 characters)' })
    }

    const result = await sendEmail({ to: recipient, subject, html, text })

    if (result.success) {
      return res.status(200).json({ success: true, messageId: result.messageId })
    }

    // Never leak provider/raw backend errors to the client
    console.error('Email send failed:', result.error)
    return res.status(500).json({ error: 'Failed to send email' })
  } catch (error) {
    console.error('Email API error:', error)
    return res.status(500).json({ error: 'Failed to send email' })
  }
}
