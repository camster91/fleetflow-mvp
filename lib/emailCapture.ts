import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

/*
 * TEST-ONLY outbound mail capture for the local Playwright server.
 *
 * Login codes, invitation links and backup codes are only ever stored hashed,
 * so an end-to-end test can only read them from the email itself. When
 * E2E_EMAIL_CAPTURE_DIR is set AND the application URL is a plain-http
 * loopback origin (http://localhost, http://127.0.0.1 or http://[::1]),
 * sendEmail() writes each message to a JSON file in that directory instead of
 * contacting Mailgun.
 *
 * It cannot activate on a real deployment: production needs a canonical HTTPS
 * NEXTAUTH_URL (scripts/verify-production-readiness.cjs and
 * validateEmailReadiness), which never matches the loopback check, and the
 * readiness preflight additionally fails whenever E2E_EMAIL_CAPTURE_DIR is set.
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export function e2eEmailCaptureDir(env: Record<string, string | undefined> = process.env): string | null {
  const dir = env.E2E_EMAIL_CAPTURE_DIR?.trim()
  if (!dir) return null
  const appUrl = (env.NEXTAUTH_URL || env.NEXT_PUBLIC_APP_URL)?.trim()
  if (!appUrl) return null
  try {
    const url = new URL(appUrl)
    if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname)) return null
  } catch {
    return null
  }
  return path.resolve(dir)
}

export interface CapturedEmail {
  to: string[]
  subject: string
  text: string
  html: string
  capturedAt: string
}

export async function captureEmail(dir: string, message: { to: string | string[]; subject: string; text?: string; html: string }) {
  await mkdir(dir, { recursive: true })
  const captured: CapturedEmail = {
    to: (Array.isArray(message.to) ? message.to : [message.to]).map((address) => address.toLowerCase()),
    subject: message.subject,
    text: message.text || '',
    html: message.html,
    capturedAt: new Date().toISOString(),
  }
  const file = path.join(dir, `${Date.now()}-${randomUUID()}.json`)
  await writeFile(file, JSON.stringify(captured), { mode: 0o600 })
  return { messageId: `e2e-capture:${path.basename(file)}` }
}
