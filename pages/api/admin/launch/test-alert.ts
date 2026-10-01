import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { requirePlatformAdmin } from '@/lib/platformAdmin'
import { notifyOps } from '@/lib/opsAlerts'

/** Sends one alert email to OPS_ALERT_EMAIL so an admin can confirm alerts arrive. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requirePlatformAdmin(req, res, { methods: ['POST'], rateKey: 'launch-test-alert' })
  if (!context) return
  if (!process.env.OPS_ALERT_EMAIL?.trim())
    return res.status(409).json({ error: 'Set the alert email in Platform settings first' })

  const user = context.session.user
  const result = await notifyOps('test', 'Test alert', [['Sent by', user.name || 'a platform administrator']], {
    force: true,
  })
  await prisma.auditLog
    .create({
      data: {
        userId: user.id,
        teamId: context.tenant.teamId,
        userName: user.name ?? null,
        userRole: context.tenant.role,
        action: 'OPS_ALERT_TESTED',
        entityType: 'platform_setting',
        entityId: 'OPS_ALERT_EMAIL',
        description: result === 'sent' ? 'Sent a test alert email' : 'Test alert email could not be sent',
        metadata: JSON.stringify({ result }),
      },
    })
    .catch(() => undefined)
  return result === 'sent'
    ? res.status(200).json({ sent: true })
    : res.status(502).json({ sent: false, error: 'The alert email could not be sent. Check Email delivery.' })
}
