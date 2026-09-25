import crypto from 'crypto'
import type { IntegrationCredentialPayload } from './types'

const b64url = (value: Buffer) => value.toString('base64url')

export function createOAuthChallenge() {
  const state = b64url(crypto.randomBytes(32))
  return {
    state,
    stateDigest: crypto.createHash('sha256').update(state).digest('hex'),
  }
}

function keyring(): Array<{ id: string; key: Buffer }> {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEYS
  if (!raw) throw new Error('INTEGRATION_ENCRYPTION_KEYS is not configured')
  const entries = raw.split(',').map((item) => {
    const separator = item.indexOf(':')
    const id = item.slice(0, separator)
    const key = Buffer.from(item.slice(separator + 1), 'base64')
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(id) || key.length !== 32)
      throw new Error('Invalid integration encryption keyring')
    return { id, key }
  })
  if (!entries.length || new Set(entries.map(({ id }) => id)).size !== entries.length)
    throw new Error('Invalid integration encryption keyring')
  return entries
}

function aad(scopeKey: string, provider: string) {
  return Buffer.from(`fleetvera-integration\0${scopeKey}\0${provider}`, 'utf8')
}

function validateCredentialPayload(value: unknown): IntegrationCredentialPayload {
  if (!value || typeof value !== 'object') throw new Error('Invalid integration credential payload')
  const payload = value as Record<string, unknown>
  const allowed = new Set(['accessToken', 'refreshToken', 'realmId'])
  if (
    Object.keys(payload).some((key) => !allowed.has(key)) ||
    typeof payload.accessToken !== 'string' ||
    payload.accessToken.length < 1 ||
    payload.accessToken.length > 8192
  )
    throw new Error('Invalid integration credential payload')
  if (
    payload.refreshToken !== undefined &&
    (typeof payload.refreshToken !== 'string' || payload.refreshToken.length < 1 || payload.refreshToken.length > 8192)
  )
    throw new Error('Invalid integration credential payload')
  if (
    payload.realmId !== undefined &&
    (typeof payload.realmId !== 'string' || payload.realmId.length < 1 || payload.realmId.length > 128)
  )
    throw new Error('Invalid integration credential payload')
  return payload as unknown as IntegrationCredentialPayload
}

export function encryptCredentialEnvelope(payload: IntegrationCredentialPayload, scopeKey: string, provider: string) {
  const validated = validateCredentialPayload(payload)
  const { id, key } = keyring()[0]
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(aad(scopeKey, provider))
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(validated), 'utf8'), cipher.final()])
  return `v2:${id}:${b64url(iv)}:${b64url(cipher.getAuthTag())}:${b64url(ciphertext)}`
}

export function decryptCredentialEnvelope(
  stored: string,
  scopeKey: string,
  provider: string
): IntegrationCredentialPayload {
  try {
    const [version, id, iv, tag, ciphertext, ...extra] = stored.split(':')
    if (version !== 'v2' || extra.length) throw new Error('bad envelope')
    const selected = keyring().find((entry) => entry.id === id)
    if (!selected) throw new Error('unknown key')
    const decipher = crypto.createDecipheriv('aes-256-gcm', selected.key, Buffer.from(iv, 'base64url'))
    decipher.setAAD(aad(scopeKey, provider))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    const value = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString(
      'utf8'
    )
    return validateCredentialPayload(JSON.parse(value))
  } catch {
    throw new Error('Credential envelope could not be authenticated')
  }
}

export function sanitizeProviderError(_error: unknown) {
  return { code: 'PROVIDER_UNAVAILABLE', message: 'The provider is temporarily unavailable. Try again later.' }
}

export function hashOAuthState(state: string) {
  return crypto.createHash('sha256').update(state).digest('hex')
}
