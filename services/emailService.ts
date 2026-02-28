// Email Service using Mailgun API
// Sends transactional emails for all FleetFlow features

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || ''
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || 'fleetflow.ashbi.ca'
const MAILGUN_BASE_URL = process.env.MAILGUN_BASE_URL || 'https://api.mailgun.net/v3'
const FROM_EMAIL = process.env.FROM_EMAIL || 'FleetFlow <notifications@fleetflow.ashbi.ca>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://fleet.ashbi.ca'

interface EmailAttachment {
  filename: string
  data: Buffer | string
  contentType?: string
}

interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  attachments?: EmailAttachment[]
  cc?: string | string[]
  bcc?: string | string[]
  replyTo?: string
}

interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send email via Mailgun API
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  // If no API key, log and return success in development
  if (!MAILGUN_API_KEY) {
    console.log('📧 Email would be sent (no API key configured):', {
      to: options.to,
      subject: options.subject
    })
    return { success: true, messageId: 'dev-mode' }
  }

  try {
    const formData = new URLSearchParams()
    
    // Add recipients
    const toEmails = Array.isArray(options.to) ? options.to : [options.to]
    formData.append('to', toEmails.join(','))
    
    // Add CC if provided
    if (options.cc) {
      const ccEmails = Array.isArray(options.cc) ? options.cc : [options.cc]
      formData.append('cc', ccEmails.join(','))
    }
    
    // Add BCC if provided
    if (options.bcc) {
      const bccEmails = Array.isArray(options.bcc) ? options.bcc : [options.bcc]
      formData.append('bcc', bccEmails.join(','))
    }
    
    // Add from, subject, and content
    formData.append('from', FROM_EMAIL)
    formData.append('subject', options.subject)
    formData.append('html', options.html)
    
    if (options.text) {
      formData.append('text', options.text)
    }
    
    if (options.replyTo) {
      formData.append('h:Reply-To', options.replyTo)
    }

    const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')
    
    const response = await fetch(`${MAILGUN_BASE_URL}/${MAILGUN_DOMAIN}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Mailgun API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    
    return {
      success: true,
      messageId: result.id
    }
  } catch (error) {
    console.error('Failed to send email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Send email to multiple recipients (batch)
 */
export async function sendBulkEmail(
  recipients: string[],
  subject: string,
  html: string,
  text?: string
): Promise<EmailResult[]> {
  const results: EmailResult[] = []
  
  // Send in batches of 100 (Mailgun limit per request)
  const batchSize = 100
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize)
    const result = await sendEmail({
      to: batch,
      subject,
      html,
      text
    })
    results.push(result)
  }
  
  return results
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Get admin email addresses from database or config
 */
export async function getAdminEmails(): Promise<string[]> {
  // In production, this would fetch from database
  // For now, return from env or default
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || []
  return adminEmails.filter(isValidEmail)
}

export { APP_URL, FROM_EMAIL, MAILGUN_DOMAIN }
