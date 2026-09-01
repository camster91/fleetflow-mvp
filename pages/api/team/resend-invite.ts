import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession, authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { sendTeamInvitationEmail } from '../../../lib/email'
import { assertSameOrigin } from '../../../lib/apiAuth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' })
  if (!assertSameOrigin(req, res)) return

  const { memberId } = req.body ?? {}
  if (!memberId || typeof memberId !== 'string') {
    return res.status(400).json({ error: 'memberId required' })
  }

  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
    include: {
      team: { select: { name: true, ownerId: true } },
      user: { select: { email: true, name: true } },
    },
  })
  if (!member) return res.status(404).json({ error: 'Invitation not found' })
  if (member.status !== 'PENDING') {
    return res.status(400).json({ error: 'Invitation is not pending' })
  }

  const requesterMembership = await prisma.teamMember.findFirst({
    where: {
      userId: session.user.id,
      teamId: member.teamId,
      status: 'ACCEPTED',
      role: 'ADMIN',
    },
  })
  if (member.team.ownerId !== session.user.id && !requesterMembership) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const inviteeEmail = member.inviteeEmail || member.user?.email
  if (!inviteeEmail) return res.status(400).json({ error: 'No email address for this invite' })

  await prisma.teamMember.update({
    where: { id: member.id },
    data: { invitedAt: new Date() },
  })
  const result = await sendTeamInvitationEmail(
    inviteeEmail,
    session.user.name || session.user.email || 'A team admin',
    member.role,
    member.team.name,
    member.id
  )
  if (!result.success) return res.status(502).json({ error: 'Failed to send invitation email' })
  return res.json({ success: true, message: 'Invitation resent successfully' })
}
