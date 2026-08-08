import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireTenantContext } from '../../../lib/apiAuth'
import { canViewBilling } from '../../../lib/permissions'

const CURRENCIES = new Set(['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'NZD'])

function safeStripePdf(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'stripe.com' || url.hostname.endsWith('.stripe.com')) ? url.toString() : null
  } catch { return null }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const context = await requireTenantContext(req, res)
  if (!context) return
  if (!canViewBilling(context.tenant.role)) return res.status(403).json({ error: 'Forbidden' })

  try {
    const invoices = await prisma.invoice.findMany({
      where: { userId: context.tenant.ownerId },
      select: {
        id: true, amount: true, currency: true, status: true, invoicePdf: true,
        createdAt: true, periodStart: true, periodEnd: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    const validInvoices = invoices.flatMap(invoice => {
      const currency = invoice.currency.toUpperCase()
      if (!Number.isSafeInteger(invoice.amount) || !CURRENCIES.has(currency) ||
          !Number.isFinite(invoice.createdAt.getTime()) || !Number.isFinite(invoice.periodStart.getTime()) || !Number.isFinite(invoice.periodEnd.getTime())) return []
      return [{ ...invoice, currency, invoicePdf: safeStripePdf(invoice.invoicePdf) }]
    })
    return res.status(200).json({ invoices: validInvoices })
  } catch {
    console.error('Invoice history query failed')
    return res.status(500).json({ error: 'Failed to load invoices' })
  }
}
