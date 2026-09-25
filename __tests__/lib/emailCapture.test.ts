import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs'
import os from 'os'
import path from 'path'

const mockMessagesCreate = jest.fn(async () => ({ id: 'provider-id' }))
jest.mock('mailgun.js', () => ({
  __esModule: true,
  default: class MailgunMock {
    client() { return { messages: { create: mockMessagesCreate } } }
  },
}))

import { e2eEmailCaptureDir } from '@/lib/emailCapture'

describe('E2E email capture guard', () => {
  it('is off unless E2E_EMAIL_CAPTURE_DIR is set', () => {
    expect(e2eEmailCaptureDir({ NEXTAUTH_URL: 'http://localhost:3000' })).toBeNull()
  })

  it.each([
    'https://fleet.ashbi.ca',
    'https://localhost:3000',
    'http://fleet.example.com',
    'http://localhost.example.com',
    'not a url',
    '',
  ])('refuses to capture for the application URL %p', (url) => {
    expect(e2eEmailCaptureDir({ E2E_EMAIL_CAPTURE_DIR: '/tmp/mail', NEXTAUTH_URL: url })).toBeNull()
  })

  it.each(['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000'])('captures for the loopback origin %p', (url) => {
    expect(e2eEmailCaptureDir({ E2E_EMAIL_CAPTURE_DIR: '/tmp/mail', NEXTAUTH_URL: url })).toBe(path.resolve('/tmp/mail'))
  })
})

describe('sendEmail with E2E capture', () => {
  const previousEnv = process.env
  let dir: string

  beforeEach(() => {
    jest.resetModules()
    mockMessagesCreate.mockClear()
    dir = mkdtempSync(path.join(os.tmpdir(), 'e2e-mail-'))
  })
  afterEach(() => {
    process.env = previousEnv
    rmSync(dir, { recursive: true, force: true })
  })

  const mailgunEnv = {
    NODE_ENV: 'production' as const,
    MAILGUN_API_KEY: 'test-key',
    MAILGUN_DOMAIN: 'mg.example.com',
    MAILGUN_VERIFIED_DOMAIN: 'mg.example.com',
    FROM_EMAIL: 'Fleetvera <notify@mg.example.com>',
  }

  it('writes the message to the capture directory for a local server and never calls the provider', async () => {
    process.env = { ...previousEnv, ...mailgunEnv, NEXTAUTH_URL: 'http://localhost:3000', E2E_EMAIL_CAPTURE_DIR: dir }
    const { sendLoginCodeEmail } = await import('@/lib/email')
    const result = await sendLoginCodeEmail('Person@Example.test', 'Person', '123456')
    expect(result.success).toBe(true)
    expect(mockMessagesCreate).not.toHaveBeenCalled()
    const files = readdirSync(dir)
    expect(files).toHaveLength(1)
    const captured = JSON.parse(readFileSync(path.join(dir, files[0]), 'utf8'))
    expect(captured.to).toEqual(['person@example.test'])
    expect(captured.text).toContain('123456')
  })

  it('ignores the capture directory on an HTTPS deployment and delivers through the provider', async () => {
    process.env = { ...previousEnv, ...mailgunEnv, NEXTAUTH_URL: 'https://fleet.example.com', E2E_EMAIL_CAPTURE_DIR: dir }
    const { sendEmail } = await import('@/lib/email')
    const result = await sendEmail({ to: 'recipient@example.com', subject: 'subject', html: '<p>body</p>' })
    expect(result).toEqual({ success: true, messageId: 'provider-id' })
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1)
    expect(readdirSync(dir)).toHaveLength(0)
  })
})
