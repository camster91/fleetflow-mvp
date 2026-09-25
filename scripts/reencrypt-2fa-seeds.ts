/**
 * Re-encrypt stored TOTP 2FA seeds under the current TOKEN_ENCRYPTION_KEY.
 *
 * Use after changing TOKEN_ENCRYPTION_KEY: put the old value(s) in
 * TOKEN_ENCRYPTION_KEY_PREVIOUS, deploy, then run
 *   npm run secrets:reencrypt-2fa            (dry run: counts only)
 *   npm run secrets:reencrypt-2fa -- --apply (writes)
 * Prints counts only; never prints secrets or user identifiers.
 */
import { PrismaClient } from '@prisma/client'
import { decryptSecret, encryptSecret, needsReencryption } from '../lib/cryptoSecrets'

async function main() {
  const apply = process.argv.includes('--apply')
  const prisma = new PrismaClient()
  const counts = { scanned: 0, current: 0, reencrypted: 0, failed: 0 }
  try {
    const users = await prisma.user.findMany({
      where: { twoFactorSecret: { not: null } },
      select: { id: true, twoFactorSecret: true },
    })
    for (const user of users) {
      counts.scanned++
      const stored = user.twoFactorSecret as string
      if (!needsReencryption(stored)) {
        counts.current++
        continue
      }
      try {
        const plaintext = decryptSecret(stored)
        if (apply) {
          await prisma.user.updateMany({
            where: { id: user.id, twoFactorSecret: stored },
            data: { twoFactorSecret: encryptSecret(plaintext) },
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

main().catch(() => {
  console.error('Re-encryption failed')
  process.exitCode = 1
})
