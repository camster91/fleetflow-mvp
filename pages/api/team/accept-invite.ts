import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);

  try {
    const { invitationId, accept } = req.body;

    if (!invitationId) {
      return res.status(400).json({ error: 'Invitation ID required' });
    }

    // Find the invitation
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

    // If user is logged in, verify they match the invitation
    if (session?.user?.id) {
      // If invitation has a userId, verify it matches
      if (invitation.userId && invitation.userId !== session.user.id) {
        return res.status(403).json({ error: 'This invitation is for a different user' });
      }

      // Update the invitation
      const updated = await prisma.teamMember.update({
        where: { id: invitationId },
        data: {
          status: accept ? 'ACCEPTED' : 'DECLINED',
          joinedAt: accept ? new Date() : null,
          userId: session.user.id,
        },
      });

      return res.status(200).json({
        success: true,
        status: updated.status,
        team: invitation.team.name,
      });
    } else {
      // User is not logged in - they need to create an account first
      return res.status(401).json({
        error: 'Authentication required',
        requiresSignup: !invitation.userId,
        canLogin: !!invitation.userId,
        teamName: invitation.team.name,
      });
    }
  } catch (error) {
    console.error('Failed to process invitation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
