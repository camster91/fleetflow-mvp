import {
  createOAuthChallenge,
  decryptCredentialEnvelope,
  encryptCredentialEnvelope,
  sanitizeProviderError,
} from '@/lib/integrations/oauth'

describe('integration OAuth security', () => {
  const previous = process.env.INTEGRATION_ENCRYPTION_KEYS

  beforeEach(() => {
    process.env.INTEGRATION_ENCRYPTION_KEYS = `current:${Buffer.alloc(32, 7).toString('base64')},old:${Buffer.alloc(32, 3).toString('base64')}`
  })

  afterAll(() => {
    if (previous === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEYS
    else process.env.INTEGRATION_ENCRYPTION_KEYS = previous
  })

  it('creates an opaque state digest without persisting plaintext state', () => {
    const challenge = createOAuthChallenge()
    expect(challenge.state).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(challenge.stateDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(challenge.stateDigest).not.toContain(challenge.state)
  })

  it('authenticates the workspace/provider as additional data and supports key rotation', () => {
    const encrypted = encryptCredentialEnvelope({ accessToken: 'secret', refreshToken: 'refresh' }, 'team:a', 'quickbooks')
    expect(encrypted).toMatch(/^v2:current:/)
    expect(encrypted).not.toContain('secret')
    expect(decryptCredentialEnvelope(encrypted, 'team:a', 'quickbooks')).toEqual({ accessToken: 'secret', refreshToken: 'refresh' })
    expect(() => decryptCredentialEnvelope(encrypted, 'team:b', 'quickbooks')).toThrow('Credential envelope could not be authenticated')

    process.env.INTEGRATION_ENCRYPTION_KEYS = `next:${Buffer.alloc(32, 9).toString('base64')},current:${Buffer.alloc(32, 7).toString('base64')}`
    expect(decryptCredentialEnvelope(encrypted, 'team:a', 'quickbooks')).toEqual({ accessToken: 'secret', refreshToken: 'refresh' })
  })

  it('never returns provider response bodies, tokens, or identifiers in safe errors', () => {
    expect(sanitizeProviderError(new Error('Bearer abc customer 123 failed'))).toEqual({
      code: 'PROVIDER_UNAVAILABLE',
      message: 'The provider is temporarily unavailable. Try again later.',
    })
  })

  it('rejects malformed or oversized credential payloads before encryption', () => {
    expect(() => encryptCredentialEnvelope({ accessToken: '' }, 'team:a', 'quickbooks')).toThrow('Invalid integration credential payload')
    expect(() => encryptCredentialEnvelope({ accessToken: 'x'.repeat(8193) }, 'team:a', 'quickbooks')).toThrow('Invalid integration credential payload')
    expect(() => encryptCredentialEnvelope({ accessToken: 'ok', realmId: 'x'.repeat(129) }, 'team:a', 'quickbooks')).toThrow('Invalid integration credential payload')
  })
})
