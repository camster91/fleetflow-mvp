import type { NextApiRequest, NextApiResponse } from 'next'
// Single-tenant deployment: all features are always active
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    plan: 'UNLIMITED',
    status: 'active',
    features: { all: true },
  })
}
