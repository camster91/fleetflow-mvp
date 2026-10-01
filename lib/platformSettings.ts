/**
 * Deployment-wide provider settings that a platform admin can enter in /admin/settings instead of the
 * environment: Stripe billing, Google Maps + QuickBooks, the AI provider, the cron secret, the operations
 * alert address and the Coolify redeploy hook.
 *
 * - Each value is stored AES-256-GCM encrypted (key derived from EMAIL_CONFIG_ENCRYPTION_KEY) and bound
 *   to its setting name, so a stored value cannot be moved to another setting.
 * - Admin values win: they are copied over process.env at server start and every minute after
 *   (instrumentation.ts), and straight after an admin saves. Code keeps reading process.env.
 * - Removing an admin value, or a value that no longer decrypts, falls back to the environment value.
 */
import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export type SettingGroup = 'billing' | 'integrations' | 'ai' | 'operations' | 'deploy'

export interface SettingDefinition {
  key: string
  group: SettingGroup
  label: string
  help: string
  /** Secrets are write-only: never returned by the API, only their source. */
  secret: boolean
  schema: z.ZodType<string, z.ZodTypeDef, unknown>
}

const token = (pattern: RegExp, message: string) => z.string().trim().max(1024).regex(pattern, message)
const httpsUrl = (message: string) =>
  z
    .string()
    .trim()
    .max(1024)
    .refine((value) => {
      try {
        const url = new URL(value)
        return url.protocol === 'https:' && !url.username && !url.password && !url.hash
      } catch {
        return false
      }
    }, message)
const integerAmount = token(/^\d{1,9}$/, 'Enter a whole number in the smallest currency unit (cents)')

export const SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  {
    key: 'STRIPE_SECRET_KEY',
    group: 'billing',
    label: 'Stripe secret key',
    help: 'Secret or restricted key from Stripe → Developers → API keys (sk_… or rk_…).',
    secret: true,
    schema: token(/^(sk|rk)_(test|live)_[A-Za-z0-9]{10,}$/, 'Must be a Stripe secret key (sk_test_…, sk_live_…, rk_…)'),
  },
  {
    key: 'STRIPE_WEBHOOK_SECRET',
    group: 'billing',
    label: 'Stripe webhook signing secret',
    help: 'Signing secret of the /api/stripe/webhook endpoint (whsec_…).',
    secret: true,
    schema: token(/^whsec_[A-Za-z0-9+/=_-]{10,}$/, 'Must be a Stripe webhook signing secret (whsec_…)'),
  },
  {
    key: 'STRIPE_PRICE_MONTHLY',
    group: 'billing',
    label: 'Monthly price ID',
    help: 'Recurring monthly price (price_…).',
    secret: false,
    schema: token(/^price_[A-Za-z0-9]{6,}$/, 'Must be a Stripe price ID (price_…)'),
  },
  {
    key: 'STRIPE_PRICE_YEARLY',
    group: 'billing',
    label: 'Yearly price ID',
    help: 'Recurring yearly price (price_…).',
    secret: false,
    schema: token(/^price_[A-Za-z0-9]{6,}$/, 'Must be a Stripe price ID (price_…)'),
  },
  {
    key: 'STRIPE_PRICE_MONTHLY_AMOUNT',
    group: 'billing',
    label: 'Monthly amount (cents)',
    help: 'Shown on the pricing page; must match the Stripe price, e.g. 4900 for 49.00.',
    secret: false,
    schema: integerAmount,
  },
  {
    key: 'STRIPE_PRICE_YEARLY_AMOUNT',
    group: 'billing',
    label: 'Yearly amount (cents)',
    help: 'Shown on the pricing page; must match the Stripe price.',
    secret: false,
    schema: integerAmount,
  },
  {
    key: 'STRIPE_PRICE_CURRENCY',
    group: 'billing',
    label: 'Currency',
    help: 'USD, CAD, EUR, GBP, AUD or NZD.',
    secret: false,
    schema: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .pipe(z.enum(['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'NZD'], { message: 'Use USD, CAD, EUR, GBP, AUD or NZD' })),
  },
  {
    key: 'GOOGLE_MAPS_SERVER_API_KEY',
    group: 'integrations',
    label: 'Google Maps server API key',
    help: 'Server key restricted to the Geocoding API.',
    secret: true,
    schema: token(/^[A-Za-z0-9_-]{20,200}$/, 'Must be a Google API key'),
  },
  {
    key: 'QUICKBOOKS_CLIENT_ID',
    group: 'integrations',
    label: 'QuickBooks client ID',
    help: 'From the Intuit developer app’s Keys & credentials.',
    secret: false,
    schema: token(/^[A-Za-z0-9]{10,200}$/, 'Must be a QuickBooks client ID'),
  },
  {
    key: 'QUICKBOOKS_CLIENT_SECRET',
    group: 'integrations',
    label: 'QuickBooks client secret',
    help: 'From the Intuit developer app’s Keys & credentials.',
    secret: true,
    schema: token(/^[A-Za-z0-9]{10,200}$/, 'Must be a QuickBooks client secret'),
  },
  {
    key: 'QUICKBOOKS_REDIRECT_URI',
    group: 'integrations',
    label: 'QuickBooks redirect URI',
    help: 'https://<your domain>/api/integrations/quickbooks/callback — also registered in the Intuit app.',
    secret: false,
    schema: httpsUrl('Must be an https URL'),
  },
  {
    key: 'AI_PROVIDER',
    group: 'ai',
    label: 'AI provider',
    help: '“openai” turns the assistant provider on; “disabled” turns it off.',
    secret: false,
    schema: z.enum(['openai', 'disabled'], { message: 'Use openai or disabled' }),
  },
  {
    key: 'OPENAI_API_KEY',
    group: 'ai',
    label: 'OpenAI API key',
    help: 'Project key from platform.openai.com (sk-…).',
    secret: true,
    schema: token(/^sk-[A-Za-z0-9_-]{29,}$/, 'Must be an OpenAI API key (sk-…)'),
  },
  {
    key: 'OPENAI_MODEL',
    group: 'ai',
    label: 'OpenAI model',
    help: 'Model name, e.g. gpt-4.1-mini.',
    secret: false,
    schema: token(/^[A-Za-z0-9._:-]{1,100}$/, 'Must be a model name'),
  },
  {
    key: 'CRON_SECRET',
    group: 'operations',
    label: 'Cron secret',
    help: 'Bearer token scheduled jobs send. Update the scheduler in Coolify when you change it.',
    secret: true,
    schema: token(/^\S{32,512}$/, 'Must be at least 32 characters with no spaces'),
  },
  {
    key: 'OPS_ALERT_EMAIL',
    group: 'operations',
    label: 'Alert email',
    help: 'Receives an email when a scheduled job fails or a server request crashes (at most one per problem every 30 minutes).',
    secret: false,
    schema: z
      .string()
      .trim()
      .max(254)
      .toLowerCase()
      .regex(/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/, 'Must be one email address'),
  },
  {
    key: 'COOLIFY_DEPLOY_WEBHOOK',
    group: 'deploy',
    label: 'Coolify deploy webhook',
    help: 'Coolify → your application → Webhooks → Deploy webhook (https://…/api/v1/deploy?uuid=…).',
    secret: false,
    schema: httpsUrl('Must be an https URL'),
  },
  {
    key: 'COOLIFY_API_TOKEN',
    group: 'deploy',
    label: 'Coolify API token',
    help: 'Coolify → Keys & Tokens → API tokens, with deploy permission.',
    secret: true,
    schema: token(/^[A-Za-z0-9|._-]{16,512}$/, 'Must be a Coolify API token'),
  },
]

const DEFINITIONS = new Map(SETTING_DEFINITIONS.map((definition) => [definition.key, definition]))

export function settingDefinition(key: string): SettingDefinition | undefined {
  return DEFINITIONS.get(key)
}

const PREFIX = 'setting-v1:'

function encryptionKey(): Buffer {
  const raw = process.env.EMAIL_CONFIG_ENCRYPTION_KEY
  if (!raw || raw.length < 32) throw new Error('EMAIL_CONFIG_ENCRYPTION_KEY is not configured')
  // A key separate from the Mailgun envelope key, derived from the same deployment secret.
  return Buffer.from(crypto.hkdfSync('sha256', raw, Buffer.alloc(0), 'fleetvera-platform-settings:v1', 32))
}

const aad = (key: string) => Buffer.from(`fleetvera-platform-setting:v1:${key}`, 'utf8')

export function encryptSetting(key: string, value: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv)
  cipher.setAAD(aad(key))
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `${PREFIX}${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${ciphertext.toString('base64url')}`
}

export function decryptSetting(key: string, envelope: string): string {
  try {
    const [prefix, iv, tag, ciphertext, ...rest] = envelope.split(':')
    if (`${prefix}:` !== PREFIX || rest.length) throw new Error('invalid')
    const decode = (part: string) => {
      const decoded = Buffer.from(part, 'base64url')
      if (!part || decoded.toString('base64url') !== part) throw new Error('invalid')
      return decoded
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), decode(iv))
    decipher.setAAD(aad(key))
    decipher.setAuthTag(decode(tag))
    return Buffer.concat([decipher.update(decode(ciphertext)), decipher.final()]).toString('utf8')
  } catch {
    throw new Error(`Stored setting ${key} could not be authenticated`)
  }
}

/**
 * Overlay state lives on globalThis: Next bundles instrumentation and each API route separately, so a
 * module-level variable would not be shared, while process.env is.
 */
interface OverlayState {
  /** Environment values from before an admin value replaced them (undefined = was unset). */
  original: Map<string, string | undefined>
  loadedAt: number
  inflight: Promise<void> | null
}

const globalState = globalThis as typeof globalThis & { __fleetveraPlatformSettings?: OverlayState }

function state(): OverlayState {
  globalState.__fleetveraPlatformSettings ??= { original: new Map(), loadedAt: 0, inflight: null }
  return globalState.__fleetveraPlatformSettings
}

/** The environment value for `key`, ignoring any admin override. */
export function environmentValue(key: string): string | undefined {
  const overlay = state()
  return overlay.original.has(key) ? overlay.original.get(key) : process.env[key]
}

/** Make process.env reflect `values` (admin wins), restoring the environment for keys not in it. */
export function applySettings(values: Map<string, string>): void {
  const overlay = state()
  for (const { key } of SETTING_DEFINITIONS) {
    const value = values.get(key)
    if (value !== undefined) {
      if (!overlay.original.has(key)) overlay.original.set(key, process.env[key])
      process.env[key] = value
    } else if (overlay.original.has(key)) {
      const original = overlay.original.get(key)
      if (original === undefined) delete process.env[key]
      else process.env[key] = original
      overlay.original.delete(key)
    }
  }
}

type SettingsDb = Pick<typeof prisma, 'platformSetting'>

export interface StoredSetting {
  key: string
  value: string | null
  updatedAt: Date
}

/** Every stored setting; `value` is null when it no longer decrypts (e.g. the encryption key changed). */
export async function readStoredSettings(db: SettingsDb = prisma): Promise<StoredSetting[]> {
  const rows = await db.platformSetting.findMany({ select: { key: true, envelope: true, updatedAt: true } })
  return rows
    .filter((row) => DEFINITIONS.has(row.key))
    .map((row) => {
      try {
        return { key: row.key, value: decryptSetting(row.key, row.envelope), updatedAt: row.updatedAt }
      } catch {
        return { key: row.key, value: null, updatedAt: row.updatedAt }
      }
    })
}

export const REFRESH_INTERVAL_MS = 60_000

/**
 * Load admin settings into process.env. Without `force`, does nothing when loaded within the last
 * minute. A database error keeps the current values; an undecryptable value falls back to the environment.
 */
export async function refreshPlatformSettings(
  { force = false, db = prisma }: { force?: boolean; db?: SettingsDb } = {},
  now = Date.now()
): Promise<void> {
  const overlay = state()
  if (!force && overlay.loadedAt && now - overlay.loadedAt < REFRESH_INTERVAL_MS) return
  if (overlay.inflight && !force) return overlay.inflight
  const run = (async () => {
    const stored = await readStoredSettings(db)
    const values = new Map<string, string>()
    for (const setting of stored) {
      if (setting.value !== null) values.set(setting.key, setting.value)
      else console.warn(`[platform-settings] ${setting.key} could not be decrypted; using the environment value`)
    }
    applySettings(values)
    overlay.loadedAt = now
  })()
  overlay.inflight = run
  try {
    await run
  } finally {
    if (overlay.inflight === run) overlay.inflight = null
  }
}

export type SettingSource = 'admin' | 'environment' | 'unset' | 'unreadable'

export interface PublicSetting {
  key: string
  group: SettingGroup
  label: string
  help: string
  secret: boolean
  source: SettingSource
  /** Only for non-secret settings. */
  value: string | null
  /** An environment value exists to fall back to when the admin value is removed. */
  environmentFallback: boolean
  /** For the Stripe key only: whether it is a test or live key. */
  mode?: 'test' | 'live'
  updatedAt: string | null
}

export function describeSettings(stored: StoredSetting[]): PublicSetting[] {
  const byKey = new Map(stored.map((setting) => [setting.key, setting]))
  return SETTING_DEFINITIONS.map((definition) => {
    const row = byKey.get(definition.key)
    const fromEnv = environmentValue(definition.key)?.trim() || null
    const effective = row?.value ?? fromEnv
    const source: SettingSource = row
      ? row.value === null
        ? 'unreadable'
        : 'admin'
      : fromEnv
        ? 'environment'
        : 'unset'
    const mode =
      definition.key === 'STRIPE_SECRET_KEY' && effective
        ? /^(sk|rk)_live_/.test(effective)
          ? 'live'
          : /^(sk|rk)_test_/.test(effective)
            ? 'test'
            : undefined
        : undefined
    return {
      key: definition.key,
      group: definition.group,
      label: definition.label,
      help: definition.help,
      secret: definition.secret,
      source,
      value: definition.secret ? null : (effective ?? null),
      environmentFallback: Boolean(fromEnv),
      ...(mode ? { mode } : {}),
      updatedAt: row ? row.updatedAt.toISOString() : null,
    }
  })
}
