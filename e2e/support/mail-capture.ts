import { readdir, readFile, rm } from 'fs/promises'
import os from 'os'
import path from 'path'

/*
 * Reads the outbound mail the local test server captured (lib/emailCapture.ts).
 * playwright.config.ts passes this directory to the server it starts; capture
 * is refused for any non-loopback application URL, so it never runs on a
 * deployment.
 */
export const E2E_EMAIL_CAPTURE_DIR = process.env.E2E_EMAIL_CAPTURE_DIR || path.join(os.tmpdir(), 'fleetvera-e2e-mail')

interface CapturedEmail {
  to: string[]
  subject: string
  text: string
  html: string
  capturedAt: string
}

async function messagesFor(address: string): Promise<CapturedEmail[]> {
  let files: string[]
  try {
    files = await readdir(E2E_EMAIL_CAPTURE_DIR)
  } catch {
    return []
  }
  const messages: CapturedEmail[] = []
  for (const file of files.filter((name) => name.endsWith('.json')).sort()) {
    try {
      const message = JSON.parse(await readFile(path.join(E2E_EMAIL_CAPTURE_DIR, file), 'utf8')) as CapturedEmail
      if (message.to.includes(address.toLowerCase())) messages.push(message)
    } catch {
      /* a file still being written is picked up on the next poll */
    }
  }
  return messages
}

/** Wait for the next captured message to `address` whose subject matches, newer than `since`. */
export async function waitForEmail(
  address: string,
  subject: RegExp,
  since: number,
  timeoutMs = 15_000
): Promise<CapturedEmail> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const match = (await messagesFor(address))
      .reverse()
      .find((message) => subject.test(message.subject) && Date.parse(message.capturedAt) >= since)
    if (match) return match
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(
    `No captured email to ${address} matching ${subject} (is the server running with E2E_EMAIL_CAPTURE_DIR=${E2E_EMAIL_CAPTURE_DIR}?)`
  )
}

/** Read the 6-digit login code from the newest login-code email to `address`. */
export async function waitForLoginCode(address: string, since: number): Promise<string> {
  const message = await waitForEmail(address, /login code/i, since)
  const code = message.text.match(/login code is: (\d{6})/)?.[1]
  if (!code) throw new Error('Captured login email has no code')
  return code
}

/** Remove messages captured for `address` (keeps a shared capture directory small). */
export async function clearEmailsFor(address: string) {
  let files: string[]
  try {
    files = await readdir(E2E_EMAIL_CAPTURE_DIR)
  } catch {
    return
  }
  await Promise.all(
    files.map(async (file) => {
      const full = path.join(E2E_EMAIL_CAPTURE_DIR, file)
      try {
        const message = JSON.parse(await readFile(full, 'utf8')) as CapturedEmail
        if (message.to.includes(address.toLowerCase())) await rm(full, { force: true })
      } catch {
        /* ignore */
      }
    })
  )
}
