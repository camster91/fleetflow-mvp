import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { assertSameOrigin, requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { rateLimitMiddleware } from '@/lib/rateLimit'
import { encryptMailgunApiKey, publicEmailConfig } from '@/lib/emailConfig'

const email = z.string().trim().email().max(254)
const schema = z
  .object({
    apiKey: z.string().trim().min(8).max(512),
    domain: z
      .string()
      .trim()
      .min(3)
      .max(253)
      .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i),
    verifiedDomain: z.string().trim().min(3).max(253),
    fromEmail: z.string().trim().max(320),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.domain.toLowerCase() !== value.verifiedDomain.toLowerCase())
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['verifiedDomain'],
        message: 'Verified domain must match sending domain',
      })
    const address = value.fromEmail.match(/<([^>]+)>$/)?.[1] || value.fromEmail
    if (!email.safeParse(address).success || address.split('@')[1]?.toLowerCase() !== value.domain.toLowerCase())
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fromEmail'],
        message: 'Sender must use the configured domain',
      })
  })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'PUT'].includes(req.method ?? '')) {
    res.setHeader('Allow', 'GET, PUT')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (req.method === 'PUT' && !assertSameOrigin(req, res)) return
  const context = await requireTenantContext(req, res)
  if (!context) return
  // This is a single deployment-wide provider credential, not workspace data.
  // Team ownership must never grant the ability to replace it.
  if (context.session.user.role !== 'admin')
    return res.status(403).json({ error: 'Platform administrator access is required' })
  if (!(await rateLimitMiddleware(req, res, 'admin', `email-delivery:${context.session.user.id}`))) return
  if (req.method === 'GET')
    return res
      .status(200)
      .json({ config: publicEmailConfig(await prisma.emailDeliveryConfig.findUnique({ where: { id: 'global' } })) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid email delivery configuration' })
  try {
    const saved = await prisma.$transaction(async (tx) => {
      const config = await tx.emailDeliveryConfig.upsert({
        where: { id: 'global' },
        create: {
          id: 'global',
          provider: 'mailgun',
          apiKeyEnvelope: encryptMailgunApiKey(parsed.data.apiKey),
          domain: parsed.data.domain.toLowerCase(),
          verifiedDomain: parsed.data.verifiedDomain.toLowerCase(),
          fromEmail: parsed.data.fromEmail,
          configuredById: context.session.user.id,
        },
        update: {
          apiKeyEnvelope: encryptMailgunApiKey(parsed.data.apiKey),
          domain: parsed.data.domain.toLowerCase(),
          verifiedDomain: parsed.data.verifiedDomain.toLowerCase(),
          fromEmail: parsed.data.fromEmail,
          configuredById: context.session.user.id,
          configuredAt: new Date(),
        },
      })
      await tx.auditLog.create({
        data: {
          userId: context.session.user.id,
          teamId: context.tenant.teamId,
          userName: context.session.user.name ?? null,
          userRole: context.tenant.role,
          action: 'EMAIL_DELIVERY_CONFIGURATION_UPDATED',
          entityType: 'email_delivery',
          entityId: 'global',
          description: 'Updated transactional email provider configuration',
          metadata: JSON.stringify({ provider: config.provider, domain: config.domain, fromEmail: config.fromEmail }),
        },
      })
      return config
    })
    return res.status(200).json({ config: publicEmailConfig(saved) })
  } catch {
    return res.status(503).json({ error: 'Email configuration encryption is unavailable' })
  }
}
