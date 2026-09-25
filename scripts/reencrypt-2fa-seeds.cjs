#!/usr/bin/env node
/**
 * Re-encrypt stored TOTP 2FA seeds under the current TOKEN_ENCRYPTION_KEY.
 *
 * Plain CommonJS with no build step so it runs inside the production image
 * (copied to /app/reencrypt-2fa-seeds.cjs), where the database is reachable:
 *   docker exec <app-container> node reencrypt-2fa-seeds.cjs            # dry run
 *   docker exec <app-container> node reencrypt-2fa-seeds.cjs --apply    # write
 *
 * Put retired key material in TOKEN_ENCRYPTION_KEY_PREVIOUS (comma-separated)
 * before running. Refuses to run without an explicit TOKEN_ENCRYPTION_KEY so
 * it can never fall back to JWT_SECRET or a development key. Prints counts
 * only; never prints secrets or user identifiers.
 *
 * The format and key derivation must stay identical to lib/cryptoSecrets.ts;
 * __tests__/lib/reencrypt2faSeeds.test.ts checks both directions.
 */
const crypto = require('crypto')

const PREFIX = 'v1:'

function keyFromMaterial(material) {
  return crypto.createHash('sha256').update(material).digest()
}

function loadKeys(env = process.env) {
  const current = env.TOKEN_ENCRYPTION_KEY
  if (!current || !current.trim()) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be set explicitly before re-encrypting 2FA seeds')
  }
  const previous = []
  // Seeds written while a padded current key was still trimmed.
  if (current.trim() !== current) previous.push(keyFromMaterial(current.trim()))
  for (const entry of (env.TOKEN_ENCRYPTION_KEY_PREVIOUS || '').split(',')) {
    if (!entry.trim()) continue
    previous.push(keyFromMaterial(entry))
    if (entry.trim() !== entry) previous.push(keyFromMaterial(entry.trim()))
  }
  return { current: keyFromMaterial(current), all: [keyFromMaterial(current), ...previous] }
}

function tryDecrypt(stored, key) {
  const parts = stored.slice(PREFIX.length).split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted secret format')
  const [ivHex, tagHex, dataHex] = parts
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8')
}

/** Returns { plaintext, current } or throws if no configured key can decrypt it. */
function decryptWithKeys(stored, keys) {
  if (!stored.startsWith(PREFIX)) return { plaintext: stored, current: false }
  let lastError
  for (let i = 0; i < keys.all.length; i++) {
    try {
      return { plaintext: tryDecrypt(stored, keys.all[i]), current: i === 0 }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('Unable to decrypt secret')
}

function encryptWithKey(plaintext, key) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return `${PREFIX}${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`
}

async function main() {
  const apply = process.argv.includes('--apply')
  const keys = loadKeys()
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()
  const counts = { scanned: 0, current: 0, reencrypted: 0, failed: 0 }
  try {
    const users = await prisma.user.findMany({
      where: { twoFactorSecret: { not: null } },
      select: { id: true, twoFactorSecret: true },
    })
    for (const user of users) {
      counts.scanned++
      const stored = user.twoFactorSecret
      try {
        const { plaintext, current } = decryptWithKeys(stored, keys)
        if (current) {
          counts.current++
          continue
        }
        if (apply) {
          await prisma.user.updateMany({
            where: { id: user.id, twoFactorSecret: stored },
            data: { twoFactorSecret: encryptWithKey(plaintext, keys.current) },
          })
        }
        counts.reencrypted++
      } catch {
        counts.failed++
      }
    }
  } finally {
    await prisma.$disconnect()
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', ...counts }))
  if (counts.failed > 0) process.exitCode = 1
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      error instanceof Error && error.message.startsWith('TOKEN_ENCRYPTION_KEY')
        ? error.message
        : 'Re-encryption failed'
    )
    process.exitCode = 1
  })
}

module.exports = { loadKeys, decryptWithKeys, encryptWithKey }
