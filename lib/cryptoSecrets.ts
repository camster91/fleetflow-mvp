/**
 * Encrypt secrets at rest (TOTP seeds, etc.).
 * Format: v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
 * Legacy plaintext values are accepted by decryptSecret for migration.
 */
import crypto from 'crypto'

const PREFIX = 'v1:'

function deriveKey(): Buffer {
  const material =
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    process.env.NEXTAUTH_SECRET
  if (!material) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TOKEN_ENCRYPTION_KEY or JWT_SECRET must be set')
    }
    return crypto.createHash('sha256').update('dev-only-encryption-key').digest()
  }
  return crypto.createHash('sha256').update(material).digest()
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
  const key = deriveKey()
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

export function isEncryptedSecret(stored: string | null | undefined): boolean {
  return !!stored && stored.startsWith(PREFIX)
}
