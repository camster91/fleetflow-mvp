jest.mock('@/lib/prisma', () => ({ prisma: { emailDeliveryConfig: { findUnique: jest.fn() } } }))
import { decryptMailgunApiKey, encryptMailgunApiKey } from '@/lib/emailConfig'

describe('encrypted email delivery configuration', () => {
  beforeEach(() => {
    process.env.EMAIL_CONFIG_ENCRYPTION_KEY = 'e'.repeat(48)
  })
  afterEach(() => {
    delete process.env.EMAIL_CONFIG_ENCRYPTION_KEY
  })
  it('encrypts with authenticated encryption and refuses tampering', () => {
    const stored = encryptMailgunApiKey('key-12345678')
    expect(stored).not.toContain('key-12345678')
    expect(decryptMailgunApiKey(stored)).toBe('key-12345678')
    expect(() => decryptMailgunApiKey(`${stored}x`)).toThrow('could not be authenticated')
  })
})
