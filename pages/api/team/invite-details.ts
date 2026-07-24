import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { isTeamInviteExpired, TEAM_INVITE_TTL_MS } from '../../../lib/apiAuth';

function maskEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes('@')) return null;
  const [local, domain] = email.split('@');
  if (!local) return null;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

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
  if (member.status === 'EXPIRED' || isTeamInviteExpired(member.invitedAt)) {
    return res.status(410).json({ error: 'Invitation has expired' });
  }

  let inviterName = 'A team admin';
  if (member.invitedBy) {
    const inviter = await prisma.user.findUnique({
      where: { id: member.invitedBy },
      select: { name: true, email: true },
    }).catch(() => null);
    inviterName = inviter?.name || inviter?.email || 'A team admin';
  }

  const expiresAt = new Date(member.invitedAt.getTime() + TEAM_INVITE_TTL_MS);

  return res.json({
    invite: {
      id: member.id,
      teamName: member.team.name,
      invitedBy: inviterName,
      role: member.role,
      // Mask PII on this unauthenticated endpoint
      inviteeEmail: maskEmail(member.user?.email),
      expiresAt: expiresAt.toISOString(),
      isExpired: false,
    },
  });
}
