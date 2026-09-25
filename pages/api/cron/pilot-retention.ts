import type { NextApiRequest, NextApiResponse } from 'next'
import { isAuthorizedCronRequest } from '@/lib/cronAuth'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!isAuthorizedCronRequest(req)) return res.status(401).json({ error: 'Unauthorized' })
  const now = new Date()
  try {
    const [events, incidents] = await prisma.$transaction([
      prisma.pilotEvent.deleteMany({ where: { expiresAt: { lte: now } } }),
      prisma.pilotIncident.deleteMany({ where: { expiresAt: { lte: now } } }),
    ])
    return res.status(200).json({ eventsDeleted: events.count, incidentsDeleted: incidents.count })
  } catch {
    console.error('Pilot retention cleanup failed')
    return res.status(500).json({ error: 'Retention cleanup failed' })
  }
}
