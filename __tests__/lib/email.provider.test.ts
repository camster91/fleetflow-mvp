const mockMessagesCreate = jest.fn(async () => ({ id: 'provider-id' }))
jest.mock('mailgun.js', () => ({
  __esModule: true,
  default: class MailgunMock {
    client() { return { messages: { create: mockMessagesCreate } } }
  },
}))

describe('Mailgun adapter', () => {
  const previousEnv = process.env

  beforeAll(() => {
    process.env = {
      ...previousEnv,
      NODE_ENV: 'production',
      MAILGUN_API_KEY: 'test-key',
      MAILGUN_DOMAIN: 'mg.example.com',
      MAILGUN_VERIFIED_DOMAIN: 'mg.example.com',
      FROM_EMAIL: 'Fleetvera <notify@mg.example.com>',
      NEXTAUTH_URL: 'https://fleet.example.com',
    }
  })

  afterAll(() => { process.env = previousEnv })
  beforeEach(() => mockMessagesCreate.mockClear())

  it('passes correlation metadata and compatibility fields to Mailgun', async () => {
    const { sendEmail } = await import('@/lib/email')
    const result = await sendEmail({
      to: 'recipient@example.com', subject: 'subject', html: '<p>body</p>',
      cc: 'cc@example.com', bcc: ['bcc@example.com'], replyTo: 'reply@example.com',
      attachments: [{ filename: 'note.txt', data: 'content', contentType: 'text/plain' }],
      metadata: { correlationId: '67c1a311-ce67-4ed6-b096-14c3427558d5' },
    })

    expect(mockMessagesCreate).toHaveBeenCalledWith('mg.example.com', expect.objectContaining({
      cc: 'cc@example.com',
      bcc: ['bcc@example.com'],
      'h:Reply-To': 'reply@example.com',
      'v:correlation-id': '67c1a311-ce67-4ed6-b096-14c3427558d5',
      attachment: [expect.objectContaining({ filename: 'note.txt' })],
    }))
    expect(result).toEqual({ success: true, messageId: 'provider-id' })
  })

  it('returns only a sanitized provider error category', async () => {
    mockMessagesCreate.mockRejectedValueOnce({ status: 503, message: 'raw recipient and secret' })
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const { sendEmail } = await import('@/lib/email')
    const result = await sendEmail({
      to: 'recipient@example.com', subject: 'secret subject', html: '<p>secret body</p>',
    })
    expect(result).toEqual({
      success: false, errorCode: 'provider_unavailable', error: 'provider_unavailable',
    })
    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
