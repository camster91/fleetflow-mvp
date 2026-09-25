import { decryptSecret, encryptSecret } from '../../lib/cryptoSecrets'

const tool = require('../../scripts/reencrypt-2fa-seeds.cjs') as {
  loadKeys: (env: Record<string, string | undefined>) => { current: Buffer; all: Buffer[] }
  decryptWithKeys: (stored: string, keys: { current: Buffer; all: Buffer[] }) => { plaintext: string; current: boolean }
  encryptWithKey: (plaintext: string, key: Buffer) => string
}

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

describe('reencrypt-2fa-seeds.cjs', () => {
  it('refuses to run without an explicit TOKEN_ENCRYPTION_KEY, even when JWT_SECRET is set', () => {
    expect(() => tool.loadKeys({ JWT_SECRET: 'j'.repeat(40) })).toThrow(/TOKEN_ENCRYPTION_KEY/)
    expect(() => tool.loadKeys({ TOKEN_ENCRYPTION_KEY: '   ' })).toThrow(/TOKEN_ENCRYPTION_KEY/)
  })

  it('moves a seed from a previous key to the current key in a format the app can read', () => {
    const oldKey = 'old-key-'.padEnd(40, 'o')
    const newKey = 'new-key-'.padEnd(40, 'n')
    process.env.TOKEN_ENCRYPTION_KEY = oldKey
    const stored = encryptSecret('JBSWY3DPEHPK3PXP')

    const keys = tool.loadKeys({ TOKEN_ENCRYPTION_KEY: newKey, TOKEN_ENCRYPTION_KEY_PREVIOUS: oldKey })
    const decrypted = tool.decryptWithKeys(stored, keys)
    expect(decrypted).toEqual({ plaintext: 'JBSWY3DPEHPK3PXP', current: false })

    const moved = tool.encryptWithKey(decrypted.plaintext, keys.current)
    process.env.TOKEN_ENCRYPTION_KEY = newKey
    expect(decryptSecret(moved)).toBe('JBSWY3DPEHPK3PXP')
    expect(tool.decryptWithKeys(moved, keys).current).toBe(true)
  })

  it('reports seeds it cannot decrypt instead of rewriting them', () => {
    process.env.TOKEN_ENCRYPTION_KEY = 'unknown-'.padEnd(40, 'u')
    const stored = encryptSecret('LOST')
    const keys = tool.loadKeys({ TOKEN_ENCRYPTION_KEY: 'other-'.padEnd(40, 'x') })
    expect(() => tool.decryptWithKeys(stored, keys)).toThrow()
  })
})

describe('cryptoSecrets key bytes', () => {
  it('hashes TOKEN_ENCRYPTION_KEY verbatim, so keys with surrounding whitespace still decrypt old seeds', () => {
    const padded = '  spaced-key-'.padEnd(40, 's') + '  '
    process.env.TOKEN_ENCRYPTION_KEY = padded
    const stored = encryptSecret('SPACED')
    expect(decryptSecret(stored)).toBe('SPACED')
    const keys = tool.loadKeys({ TOKEN_ENCRYPTION_KEY: padded })
    expect(tool.decryptWithKeys(stored, keys)).toEqual({ plaintext: 'SPACED', current: true })
  })

  it('recovers a whitespace-bearing retired key from TOKEN_ENCRYPTION_KEY_PREVIOUS', () => {
    const padded = ' retired-'.padEnd(40, 'r') + ' '
    process.env.TOKEN_ENCRYPTION_KEY = padded
    const stored = encryptSecret('RETIRED')
    process.env.TOKEN_ENCRYPTION_KEY = 'fresh-'.padEnd(40, 'f')
    process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS = padded
    expect(decryptSecret(stored)).toBe('RETIRED')
  })

  it('still reads seeds written while a padded current key was trimmed, and flags them for re-encryption', () => {
    const trimmed = 'padded-current-'.padEnd(40, 'p')
    process.env.TOKEN_ENCRYPTION_KEY = trimmed
    const stored = encryptSecret('TRIMMEDERA')
    const padded = `  ${trimmed}  `
    process.env.TOKEN_ENCRYPTION_KEY = padded
    expect(decryptSecret(stored)).toBe('TRIMMEDERA')
    const keys = tool.loadKeys({ TOKEN_ENCRYPTION_KEY: padded })
    expect(tool.decryptWithKeys(stored, keys)).toEqual({ plaintext: 'TRIMMEDERA', current: false })
  })
})
