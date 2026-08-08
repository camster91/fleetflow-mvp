import type { NextApiRequest, NextApiResponse } from 'next'
import { getBillingAvailability } from '../../../lib/stripe'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { available, pricing } = getBillingAvailability()
  return res.status(200).json({
    available,
    pricing: available ? pricing : null,
    message: available ? null : 'Online subscription management is temporarily unavailable. Contact support for help.',
  })
}
