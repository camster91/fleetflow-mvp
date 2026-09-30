import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { assertSameOrigin, requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { rateLimitMiddleware } from '@/lib/rateLimit'
import {
  describeSettings,
  encryptSetting,
  environmentValue,
  readStoredSettings,
  refreshPlatformSettings,
  settingDefinition,
} from '@/lib/platformSettings'

const putSchema = z.object({ key: z.string().max(64), value: z.string().max(1024) }).strict()
const deleteSchema = z.object({ key: z.string().max(64) }).strict()

/** QuickBooks tokens and Maps usage are stored with the integration keyring, which stays in the environment. */
const NEEDS_INTEGRATION_KEYRING = new Set([
  'GOOGLE_MAPS_SERVER_API_KEY',
  'QUICKBOOKS_CLIENT_ID',
  'QUICKBOOKS_CLIENT_SECRET',
  'QUICKBOOKS_REDIRECT_URI',
])

async function effectiveValue(key: string): Promise<string | undefined> {
  const stored = (await readStoredSettings()).find((setting) => setting.key === key)
  return stored?.value ?? environmentValue(key)?.trim() ?? undefined
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'PUT', 'DELETE'].includes(req.method ?? '')) {
    res.setHeader('Allow', 'GET, PUT, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (req.method !== 'GET' && !assertSameOrigin(req, res)) return
  const context = await requireTenantContext(req, res)
  if (!context) return
  // Deployment-wide provider credentials, not workspace data: team ownership never grants access.
  if (context.session.user.role !== 'admin')
    return res.status(403).json({ error: 'Platform administrator access is required' })
  if (!(await rateLimitMiddleware(req, res, 'admin', `platform-settings:${context.session.user.id}`))) return

  if (req.method === 'GET') return res.status(200).json({ settings: describeSettings(await readStoredSettings()) })

  const parsedBody =
    req.method === 'PUT' ? putSchema.safeParse(req.body) : deleteSchema.safeParse({ key: req.query.key })
  const definition = parsedBody.success ? settingDefinition(parsedBody.data.key) : undefined
  if (!parsedBody.success || !definition) return res.status(400).json({ error: 'Unknown setting' })
  const key = definition.key

  let envelope: string | null = null
  let savedValue: string | null = null
  if (req.method === 'PUT') {
    const parsed = definition.schema.safeParse('value' in parsedBody.data ? parsedBody.data.value : undefined)
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid value', field: key })
    savedValue = parsed.data
    if (NEEDS_INTEGRATION_KEYRING.has(key) && !process.env.INTEGRATION_ENCRYPTION_KEYS?.trim())
      return res.status(409).json({
        error: 'Set INTEGRATION_ENCRYPTION_KEYS in the deployment environment before configuring integrations',
        field: key,
      })
    const otherPrice =
      key === 'STRIPE_PRICE_MONTHLY'
        ? 'STRIPE_PRICE_YEARLY'
        : key === 'STRIPE_PRICE_YEARLY'
          ? 'STRIPE_PRICE_MONTHLY'
          : null
    if (otherPrice && (await effectiveValue(otherPrice)) === savedValue)
      return res.status(400).json({ error: 'Monthly and yearly prices must be different', field: key })
    try {
      envelope = encryptSetting(key, savedValue)
    } catch {
      return res.status(503).json({ error: 'Settings encryption is unavailable: set EMAIL_CONFIG_ENCRYPTION_KEY' })
    }
  }

  await prisma.$transaction(async (tx) => {
    if (envelope)
      await tx.platformSetting.upsert({
        where: { key },
        create: { key, envelope, updatedById: context.session.user.id },
        update: { envelope, updatedById: context.session.user.id },
      })
    else await tx.platformSetting.deleteMany({ where: { key } })
    await tx.auditLog.create({
      data: {
        userId: context.session.user.id,
        teamId: context.tenant.teamId,
        userName: context.session.user.name ?? null,
        userRole: context.tenant.role,
        action: envelope ? 'PLATFORM_SETTING_UPDATED' : 'PLATFORM_SETTING_CLEARED',
        entityType: 'platform_setting',
        entityId: key,
        description: envelope ? `Updated ${definition.label}` : `Cleared ${definition.label}`,
        // Never the value itself, even for non-secret settings.
        metadata: JSON.stringify({ key }),
      },
    })
  })
  await refreshPlatformSettings({ force: true })
  return res.status(200).json({ settings: describeSettings(await readStoredSettings()) })
}
