import type { NextApiRequest, NextApiResponse } from 'next'
import { requireApiKey } from '../../../lib/apiAuth'
import { requireGet } from '../../../lib/publicApi'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireGet(req, res)) return
  const context = await requireApiKey(req, res, 'read')
  if (!context) return
  return res.status(200).json({
    data: {
      apiKeyId: context.apiKeyId,
      caller: context.user,
      workspace: {
        id: context.tenant.teamId,
        ownerId: context.tenant.ownerId,
        role: context.tenant.role,
        dataScope: context.tenant.teamId ? 'team' : 'personal',
      },
      scopes: context.scopes,
    },
  })
}
