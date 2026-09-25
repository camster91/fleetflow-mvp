// Compatibility facade. All Mailgun delivery now lives in the server-only
// adapter at lib/email.ts so auth and operational messages share one path.
import { APP_URL, FROM_EMAIL, MAILGUN_DOMAIN, sendEmail, validateEmailReadiness } from '../lib/email'

export type { EmailAttachment, EmailResult, SendEmailOptions } from '../lib/email'
export { APP_URL, FROM_EMAIL, MAILGUN_DOMAIN, sendEmail, validateEmailReadiness }

export async function sendBulkEmail(recipients: string[], subject: string, html: string, text: string = '') {
  const results = []
  for (let index = 0; index < recipients.length; index += 100) {
    results.push(
      await sendEmail({
        to: recipients.slice(index, index + 100),
        subject,
        html,
        text,
      })
    )
  }
  return results
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function getAdminEmails(): Promise<string[]> {
  return (process.env.ADMIN_EMAILS?.split(',') || []).map((email) => email.trim()).filter(isValidEmail)
}
