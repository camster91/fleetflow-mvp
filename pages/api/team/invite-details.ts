import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';

/** GET /api/team/invite-details?token=[teamMemberId] -- public, no auth */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.query;
  if (!token || typeof token !== 'string') return res.status(400).json({ error: 'token required' });

  const member = await prisma.teamMember.findFirst({
    where: { id: token },
    include: {
      team: { select: { name: true } },
      user: { select: { name: true, email: true } },
    },
  });

  if (!member) return res.status(404).json({ error: 'Invitation not found' });
  if (member.status === 'ACCEPTED') return res.status(410).json({ error: 'Invitation already accepted' });
  if (member.status === 'DECLINED') return res.status(410).json({ error: 'Invitation was declined' });

  // Look up inviter by invitedBy (stored as userId string)
  let inviterName = 'A team admin';
  if (member.invitedBy) {
    const inviter = await prisma.user.findUnique({
      where: { id: member.invitedBy },
      select: { name: true, email: true },
    }).catch(() => null);
    inviterName = inviter?.name || inviter?.email || 'A team admin';
  }

  const expiresAt = new Date(member.invitedAt);
  expiresAt.setDate(expiresAt.getDate() + 7);

  return res.json({
    invite: {
      id: member.id,
      teamName: member.team.name,
      invitedBy: inviterName,
      role: member.role,
      inviteeEmail: member.user?.email ?? null,
      expiresAt: expiresAt.toISOString(),
      isExpired: expiresAt < new Date(),
    },
  });
}
