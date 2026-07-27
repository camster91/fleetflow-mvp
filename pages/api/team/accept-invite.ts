import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession, authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { assertSameOrigin, isTeamInviteExpired } from '../../../lib/apiAuth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!assertSameOrigin(req, res)) return;

  const session = await getServerSession(req, res, authOptions);

  try {
    const { invitationId, accept } = req.body || {};

    if (!invitationId || typeof invitationId !== 'string') {
      return res.status(400).json({ error: 'Invitation ID required' });
    }

    const invitation = await prisma.teamMember.findUnique({
      where: { id: invitationId },
      include: {
        team: true,
        user: true,
      },
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (invitation.status !== 'PENDING') {
      return res.status(400).json({ error: 'Invitation is no longer pending' });
    }

    if (isTeamInviteExpired(invitation.invitedAt)) {
      await prisma.teamMember.update({
        where: { id: invitationId },
        data: { status: 'EXPIRED' },
      }).catch(() => undefined);
      return res.status(410).json({ error: 'Invitation has expired' });
    }

    if (!session?.user?.id) {
      return res.status(401).json({
        error: 'Authentication required',
        requiresSignup: !invitation.userId,
        canLogin: !!invitation.userId || !!invitation.inviteeEmail,
        teamName: invitation.team.name,
      });
    }

    const sessionEmail = session.user.email.toLowerCase();
    const intendedEmail =
      invitation.inviteeEmail?.toLowerCase() ||
      invitation.user?.email?.toLowerCase() ||
      null;

    if (invitation.userId) {
      if (invitation.userId !== session.user.id) {
        return res.status(403).json({ error: 'This invitation is for a different user' });
      }
    } else if (intendedEmail) {
      if (intendedEmail !== sessionEmail) {
        return res.status(403).json({ error: 'This invitation is for a different user' });
      }
    } else {
      return res.status(400).json({ error: 'Invitation is invalid; request a new invite' });
    }

    const updated = await prisma.teamMember.update({
      where: { id: invitationId },
      data: {
        status: accept ? 'ACCEPTED' : 'DECLINED',
        joinedAt: accept ? new Date() : null,
        userId: session.user.id,
        inviteeEmail: intendedEmail || sessionEmail,
      },
    });

    return res.status(200).json({
      success: true,
      status: updated.status,
      team: invitation.team.name,
    });
  } catch (error) {
    console.error('Failed to process invitation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
