import { decryptSecret, encryptSecret, needsReencryption } from '../../lib/cryptoSecrets'

const ENV_KEYS = ['TOKEN_ENCRYPTION_KEY', 'TOKEN_ENCRYPTION_KEY_PREVIOUS', 'JWT_SECRET', 'NEXTAUTH_SECRET'] as const
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
})
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

describe('2FA secret encryption key handling', () => {
  it('prefers TOKEN_ENCRYPTION_KEY over JWT_SECRET, so rotating JWT_SECRET keeps seeds readable', () => {
    process.env.TOKEN_ENCRYPTION_KEY = 'token-key-'.padEnd(40, 'x')
    process.env.JWT_SECRET = 'old-session-secret-'.padEnd(40, 'y')
    const stored = encryptSecret('JBSWY3DPEHPK3PXP')
    process.env.JWT_SECRET = 'rotated-session-secret-'.padEnd(40, 'z')
    expect(decryptSecret(stored)).toBe('JBSWY3DPEHPK3PXP')
    expect(needsReencryption(stored)).toBe(false)
  })

  it('keeps legacy JWT_SECRET-encrypted seeds readable when TOKEN_ENCRYPTION_KEY is set to the same value', () => {
    const legacy = 'legacy-session-secret-'.padEnd(40, 'a')
    process.env.JWT_SECRET = legacy
    const stored = encryptSecret('LEGACYSEED')
    process.env.TOKEN_ENCRYPTION_KEY = legacy
    process.env.JWT_SECRET = 'new-session-secret-'.padEnd(40, 'b')
    expect(decryptSecret(stored)).toBe('LEGACYSEED')
  })

  it('decrypts with TOKEN_ENCRYPTION_KEY_PREVIOUS after a key change and flags the value for re-encryption', () => {
    process.env.TOKEN_ENCRYPTION_KEY = 'first-key-'.padEnd(40, 'c')
    const stored = encryptSecret('ROTATEME')
    process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS = `unrelated-${'q'.repeat(30)}, ${'first-key-'.padEnd(40, 'c')}`
    process.env.TOKEN_ENCRYPTION_KEY = 'second-key-'.padEnd(40, 'd')
    expect(decryptSecret(stored)).toBe('ROTATEME')
    expect(needsReencryption(stored)).toBe(true)
    const reencrypted = encryptSecret(decryptSecret(stored))
    expect(needsReencryption(reencrypted)).toBe(false)
  })

  it('fails to decrypt when the old key is not provided', () => {
    process.env.TOKEN_ENCRYPTION_KEY = 'first-key-'.padEnd(40, 'e')
    const stored = encryptSecret('LOCKED')
    process.env.TOKEN_ENCRYPTION_KEY = 'second-key-'.padEnd(40, 'f')
    expect(() => decryptSecret(stored)).toThrow()
  })

  it('flags legacy plaintext seeds for re-encryption', () => {
    process.env.TOKEN_ENCRYPTION_KEY = 'key-'.padEnd(40, 'g')
    expect(needsReencryption('PLAINTEXTSEED')).toBe(true)
  })
})
