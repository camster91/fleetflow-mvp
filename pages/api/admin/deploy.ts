import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePlatformAdmin } from '@/lib/platformAdmin'
import { isAdminValue } from '@/lib/platformSettings'

const DEPLOY_TIMEOUT_MS = 15_000
const bodySchema = z.object({ confirm: z.literal(true) }).strict()

/**
 * Asks Coolify to build and deploy again through its deploy webhook (COOLIFY_DEPLOY_WEBHOOK with
 * COOLIFY_API_TOKEN, set in /admin/settings). Coolify builds whatever branch it is configured for;
 * unlike the GitHub deploy workflow this does not check CI, so the page asks for confirmation.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requirePlatformAdmin(req, res, { methods: ['POST'], rateKey: 'deploy' })
  if (!context) return
  if (!bodySchema.safeParse(req.body).success)
    return res.status(400).json({ error: 'Confirm that the latest commit passed CI before redeploying' })

  const webhook = process.env.COOLIFY_DEPLOY_WEBHOOK?.trim()
  const token = process.env.COOLIFY_API_TOKEN?.trim()
  let url: URL | null = null
  try {
    url = webhook ? new URL(webhook) : null
  } catch {
    url = null
  }
  if (!url || url.protocol !== 'https:' || !token)
    return res.status(409).json({ error: 'Set the Coolify deploy webhook and API token in Platform settings first' })
  // A token from the deployment environment is only ever sent to the webhook from that same environment,
  // so an admin-entered URL can never redirect an operator-held token to another host.
  if (isAdminValue('COOLIFY_API_TOKEN') !== isAdminValue('COOLIFY_DEPLOY_WEBHOOK'))
    return res.status(409).json({
      error:
        'Set the Coolify deploy webhook and API token in the same place (both in Platform settings or both in the environment)',
    })

  let status = 0
  let deploymentId: string | undefined
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      // Never forward the token to another host.
      redirect: 'error',
      signal: AbortSignal.timeout(DEPLOY_TIMEOUT_MS),
    })
    status = response.status
    const body = (await response.json().catch(() => null)) as {
      deployments?: Array<{ deployment_uuid?: unknown }>
    } | null
    const candidate = body?.deployments?.[0]?.deployment_uuid
    if (typeof candidate === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(candidate)) deploymentId = candidate
  } catch {
    status = 0
  }
  const ok = status >= 200 && status < 300

  const user = context.session.user
  await prisma.auditLog
    .create({
      data: {
        userId: user.id,
        teamId: context.tenant.teamId,
        userName: user.name ?? null,
        userRole: context.tenant.role,
        action: ok ? 'DEPLOY_TRIGGERED' : 'DEPLOY_FAILED',
        entityType: 'deployment',
        entityId: deploymentId ?? null,
        description: ok ? 'Asked Coolify to redeploy' : 'Coolify did not accept the redeploy',
        metadata: JSON.stringify({ status }),
      },
    })
    .catch(() => undefined)

  if (ok) return res.status(202).json({ triggered: true, deploymentId: deploymentId ?? null })
  return res.status(502).json({
    triggered: false,
    error: status
      ? `Coolify refused the redeploy (HTTP ${status}). Check the webhook and token.`
      : 'Coolify could not be reached.',
  })
}
