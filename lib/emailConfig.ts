import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

const PREFIX = 'mailgun-v1:'

function key() {
  const raw = process.env.EMAIL_CONFIG_ENCRYPTION_KEY
  if (!raw || raw.length < 32) throw new Error('EMAIL_CONFIG_ENCRYPTION_KEY is not configured')
  return crypto.createHash('sha256').update(raw, 'utf8').digest()
}

function aad() {
  return Buffer.from('fleetvera-email-delivery-config:v1', 'utf8')
}

export function encryptMailgunApiKey(value: string) {
  const iv = crypto.randomBytes(12),
    cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  cipher.setAAD(aad())
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `${PREFIX}${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${ciphertext.toString('base64url')}`
}

export function decryptMailgunApiKey(value: string) {
  try {
    const [prefix, iv, tag, ciphertext, ...rest] = value.split(':')
    if (`${prefix}:` !== PREFIX || rest.length) throw new Error('invalid')
    const decode = (part: string) => {
      const decoded = Buffer.from(part, 'base64url')
      if (!part || decoded.toString('base64url') !== part) throw new Error('invalid')
      return decoded
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), decode(iv))
    decipher.setAAD(aad())
    decipher.setAuthTag(decode(tag))
    return Buffer.concat([decipher.update(decode(ciphertext)), decipher.final()]).toString('utf8')
  } catch {
    throw new Error('Stored email provider credentials could not be authenticated')
  }
}

export type MailgunConfig = { apiKey: string; domain: string; verifiedDomain: string; fromEmail: string }

export async function configuredMailgun(): Promise<MailgunConfig | null> {
  const apiKey = process.env.MAILGUN_API_KEY,
    domain = process.env.MAILGUN_DOMAIN,
    verifiedDomain = process.env.MAILGUN_VERIFIED_DOMAIN,
    fromEmail = process.env.EMAIL_FROM || process.env.FROM_EMAIL
  if (apiKey && domain && verifiedDomain && fromEmail) return { apiKey, domain, verifiedDomain, fromEmail }
  const stored = await prisma.emailDeliveryConfig.findUnique({ where: { id: 'global' } })
  if (stored)
    return {
      apiKey: decryptMailgunApiKey(stored.apiKeyEnvelope),
      domain: stored.domain,
      verifiedDomain: stored.verifiedDomain,
      fromEmail: stored.fromEmail,
    }
  return null
}

export function publicEmailConfig(
  row: {
    provider: string
    domain: string
    verifiedDomain: string
    fromEmail: string
    configuredAt: Date
    updatedAt: Date
  } | null
) {
  return row
    ? {
        configured: true,
        provider: row.provider,
        domain: row.domain,
        verifiedDomain: row.verifiedDomain,
        fromEmail: row.fromEmail,
        configuredAt: row.configuredAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }
    : { configured: false }
}
