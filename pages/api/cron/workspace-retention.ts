import type { NextApiRequest, NextApiResponse } from 'next'
import { isAuthorizedCronRequest } from '@/lib/cronAuth'
import { runWorkspaceRetention } from '@/lib/workspaceRetention'

/**
 * Daily: warn lapsed workspaces 30 and 7 days before deletion, then delete them after 90 days
 * read-only (lib/workspaceRetention.ts). A dry run unless WORKSPACE_DELETION_ENABLED=true, and a
 * no-op while plans are not enforced (the free beta).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!isAuthorizedCronRequest(req)) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const summary = await runWorkspaceRetention()
    return res.status(summary.enforced && summary.errors > 0 ? 500 : 200).json(summary)
  } catch {
    console.error('Workspace retention run failed')
    return res.status(500).json({ error: 'Workspace retention failed' })
  }
}
