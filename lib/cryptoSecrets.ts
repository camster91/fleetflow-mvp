/**
 * Encrypt secrets at rest (TOTP seeds, etc.).
 * Format: v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
 * Legacy plaintext values are accepted by decryptSecret for migration.
 */
import crypto from 'crypto'

const PREFIX = 'v1:'

function keyFromMaterial(material: string): Buffer {
  return crypto.createHash('sha256').update(material).digest()
}

let warnedAboutFallback = false

/**
 * Current encryption key material. TOKEN_ENCRYPTION_KEY is the intended
 * source; JWT_SECRET/NEXTAUTH_SECRET remain as a legacy fallback so existing
 * deployments keep decrypting, but the production preflight
 * (scripts/verify-production-readiness.cjs) now requires TOKEN_ENCRYPTION_KEY
 * so rotating the session secret can no longer strand 2FA seeds.
 */
function currentKeyMaterial(): string | null {
  const explicit = process.env.TOKEN_ENCRYPTION_KEY?.trim()
  if (explicit) return explicit
  const legacy = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET
  if (legacy && process.env.NODE_ENV === 'production' && !warnedAboutFallback) {
    warnedAboutFallback = true
    console.warn('TOKEN_ENCRYPTION_KEY is not set; 2FA secrets are encrypted with the session signing secret. Set TOKEN_ENCRYPTION_KEY before rotating JWT_SECRET.')
  }
  return legacy || null
}

function deriveKey(): Buffer {
  const material = currentKeyMaterial()
  if (!material) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TOKEN_ENCRYPTION_KEY or JWT_SECRET must be set')
    }
    return keyFromMaterial('dev-only-encryption-key')
  }
  return keyFromMaterial(material)
}

/**
 * Keys accepted for decryption, current first. TOKEN_ENCRYPTION_KEY_PREVIOUS
 * is a comma-separated list of retired key materials kept only until
 * `npm run secrets:reencrypt-2fa -- --apply` has moved every seed to the
 * current key.
 */
function decryptionKeys(): Buffer[] {
  const keys = [deriveKey()]
  const previous = (process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
  for (const material of previous) keys.push(keyFromMaterial(material))
  return keys
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const key = deriveKey()
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) {
    // Legacy plaintext (pre-migration)
    return stored
  }
  const parts = stored.slice(PREFIX.length).split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted secret format')
  }
  const [ivHex, tagHex, dataHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')
  let lastError: unknown
  for (const key of decryptionKeys()) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Unable to decrypt secret')
}

/** True when the value is encrypted but not under the current key (or is legacy plaintext). */
export function needsReencryption(stored: string): boolean {
  if (!stored.startsWith(PREFIX)) return true
  const parts = stored.slice(PREFIX.length).split(':')
  if (parts.length !== 3) return false
  const [ivHex, tagHex, dataHex] = parts
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(), Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
    Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()])
    return false
  } catch {
    return true
  }
}

export function isEncryptedSecret(stored: string | null | undefined): boolean {
  return !!stored && stored.startsWith(PREFIX)
}
