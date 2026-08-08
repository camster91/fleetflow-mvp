jest.mock('@/lib/email', () => ({
  APP_URL: 'https://fleet.example.com', FROM_EMAIL: 'Fleetvera <notify@mg.example.com>',
  MAILGUN_DOMAIN: 'mg.example.com', sendEmail: jest.fn(async () => ({ success: true, messageId: 'id' })),
  validateEmailReadiness: jest.fn(() => ({ ready: true, errors: [] })),
}))

import * as facade from '@/services/emailService'
import { sendEmail as adapterSendEmail } from '@/lib/email'

const mockSendEmail = adapterSendEmail as jest.Mock

it('preserves facade exports and passes optional delivery fields through', async () => {
  expect(facade.MAILGUN_DOMAIN).toBe('mg.example.com')
  await facade.sendEmail({
    to: 'a@example.com', subject: 'subject', html: '<p>body</p>',
    cc: 'cc@example.com', bcc: ['bcc@example.com'], replyTo: 'reply@example.com',
    attachments: [{ filename: 'note.txt', data: 'safe' }],
  })
  expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ cc: 'cc@example.com' }))
})

it('batches recipients in groups of 100', async () => {
  const recipients = Array.from({ length: 201 }, (_, index) => `user${index}@example.com`)
  await facade.sendBulkEmail(recipients, 'subject', '<p>body</p>')
  expect(mockSendEmail).toHaveBeenCalledTimes(3)
  expect(mockSendEmail.mock.calls[0][0].to).toHaveLength(100)
  expect(mockSendEmail.mock.calls[2][0].to).toHaveLength(1)
})
