import { NextApiRequest, NextApiResponse } from 'next'
import { getUserFromRequest, signToken } from '../../../../lib/auth'
import { sessionCookie } from '../../../../lib/authCookies'
import { prisma } from '../../../../lib/prisma'
import { decryptSecret } from '../../../../lib/cryptoSecrets'
import speakeasy from 'speakeasy'
import bcrypt from 'bcryptjs'
import { assertSameOrigin } from '../../../../lib/apiAuth'

const TOTP_CODE_PATTERN = /^\d{6}$/
// Matches generateBackupCodes() in lib/tokens.ts (XXXX-XXXX-XXXX digits).
const BACKUP_CODE_PATTERN = /^\d{4}-\d{4}-\d{4}$/

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!assertSameOrigin(req, res)) return

  try {
    const session = await getUserFromRequest(req)
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { code } = req.body

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: '2FA code is required' })
    }

    const userId = session.user.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({
        error: 'Two-factor authentication is not enabled',
        code: '2FA_NOT_ENABLED',
      })
    }

    const input = code.trim()
    const invalidCode = () =>
      res.status(400).json({
        error: 'Invalid verification code',
        code: 'INVALID_CODE',
      })

    if (TOTP_CODE_PATTERN.test(input)) {
      const verified = speakeasy.totp.verify({
        secret: decryptSecret(user.twoFactorSecret),
        encoding: 'base32',
        token: input,
        window: 2,
      })
      if (!verified) return invalidCode()
    } else if (BACKUP_CODE_PATTERN.test(input)) {
      // Only well-formed backup codes reach bcrypt, and hashing runs async so
      // a burst of guesses cannot block the event loop.
      const storedBackupCodes = user.backupCodes
      const backupCodes: unknown = storedBackupCodes ? JSON.parse(storedBackupCodes) : []
      if (!storedBackupCodes || !Array.isArray(backupCodes)) return invalidCode()

      let usedBackupCodeIndex = -1

      for (let i = 0; i < backupCodes.length; i++) {
        if (typeof backupCodes[i] === 'string' && (await bcrypt.compare(input, backupCodes[i]))) {
          usedBackupCodeIndex = i
          break
        }
      }

      if (usedBackupCodeIndex < 0) return invalidCode()

      backupCodes.splice(usedBackupCodeIndex, 1)
      const consumed = await prisma.user.updateMany({
        where: {
          id: userId,
          backupCodes: storedBackupCodes,
          twoFactorEnabled: true,
        },
        data: {
          backupCodes: JSON.stringify(backupCodes),
        },
      })

      if (consumed.count !== 1) return invalidCode()
    } else {
      return invalidCode()
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        backupCodes: null,
        // Revoke every other session when 2FA protection is removed.
        tokenVersion: { increment: 1 },
      },
      select: { tokenVersion: true },
    })

    // Keep this browser signed in with a token for the new version.
    res.setHeader(
      'Set-Cookie',
      sessionCookie(
        await signToken({
          sub: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tv: updated.tokenVersion,
        })
      )
    )

    return res.status(200).json({
      message: 'Two-factor authentication disabled successfully',
      enabled: false,
    })
  } catch (error) {
    console.error('2FA disable error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
