import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireTenantContext } from '../../../lib/apiAuth'
import { canViewBilling } from '../../../lib/permissions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const context = await requireTenantContext(req, res)
  if (!context) return
  if (!canViewBilling(context.tenant.role)) return res.status(403).json({ error: 'Forbidden' })

  const invoices = await prisma.invoice.findMany({
    where: { userId: context.tenant.ownerId },
    select: {
      id: true, amount: true, currency: true, status: true, invoicePdf: true,
      createdAt: true, periodStart: true, periodEnd: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return res.status(200).json({ invoices })
}
