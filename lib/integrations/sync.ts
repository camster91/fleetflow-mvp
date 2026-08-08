import crypto from 'crypto'

export const nextBackoffMs = (attempt: number) => Math.min(8000, 250 * 2 ** Math.max(0, attempt))

export function syncIdempotencyKey(provider: string, cursor: string | null, requestId: string) {
  return crypto.createHash('sha256').update(`${provider}\0${cursor || ''}\0${requestId}`).digest('hex')
}

export function safeRemoteId(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error('Invalid provider record id')
  const id = String(value).trim()
  if (!id || id.length > 256) throw new Error('Invalid provider record id')
  return id
}

export class ProviderHttpError extends Error {
  constructor(public status: number, public providerCode: 'invalid_grant' | null = null) {
    super('Provider request failed')
    this.name = 'ProviderHttpError'
  }
}

async function readBounded(response: Response, maxBytes: number) {
  const length = Number(response.headers.get('content-length') || 0)
  if (length > maxBytes) throw new Error('provider response too large')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('provider response missing body')
  const chunks: Uint8Array[] = []; let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) { await reader.cancel(); throw new Error('provider response too large') }
    chunks.push(value)
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8')
}

export async function fetchJsonBounded(url: URL | string, init: RequestInit, maxBytes = 256_000, attempts = 3): Promise<unknown> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const response = await fetch(url, { ...init, signal: controller.signal })
      const text = await readBounded(response, response.ok ? maxBytes : Math.min(maxBytes, 16_384))
      if (!response.ok) {
        let providerCode: 'invalid_grant' | null = null
        try { if ((JSON.parse(text) as { error?: unknown }).error === 'invalid_grant') providerCode = 'invalid_grant' } catch { /* safe classification only */ }
        throw new ProviderHttpError(response.status, providerCode)
      }
      return JSON.parse(text)
    } catch (error) {
      lastError = error
      if (error instanceof ProviderHttpError && error.status !== 429 && error.status < 500) throw error
      if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, nextBackoffMs(attempt)))
    } finally { clearTimeout(timer) }
  }
  throw lastError
}
