import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface InvoiceResponse {
  id: string;
  amount: number;
  currency: string;
  status: string;
  invoicePdf: string | null;
  createdAt: string;
  periodStart: string;
  periodEnd: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get invoices for user
    const invoices = await prisma.invoice.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });

    const formattedInvoices: InvoiceResponse[] = invoices.map((invoice: { id: string; amount: number; currency: string; status: string; invoicePdf: string | null; createdAt: Date; periodStart: Date; periodEnd: Date }) => ({
      id: invoice.id,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status,
      invoicePdf: invoice.invoicePdf,
      createdAt: invoice.createdAt.toISOString(),
      periodStart: invoice.periodStart.toISOString(),
      periodEnd: invoice.periodEnd.toISOString(),
    }));

    return res.status(200).json({
      invoices: formattedInvoices,
    });
  } catch (error) {
    console.error('Invoices fetch error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch invoices',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
