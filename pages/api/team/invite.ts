import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession, authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { TeamRole, InvitationStatus } from '../../../types';
import { randomBytes } from 'crypto';
import { canManageTeam } from '../../../lib/permissions';
import { sendTeamInvitationEmail } from '../../../lib/email';

// Generate a secure invitation token
function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { teamId, emails, role, message } = req.body;

    // Validate required fields
    if (!teamId || !emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'Team ID and at least one email are required' });
    }

    // Validate role
    const validRoles: string[] = ['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'];
    const assignedRole = validRoles.includes(role) ? role : 'MEMBER';

    // Check if user has permission to invite to this team
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        OR: [
          { ownerId: session.user.id },
          {
            members: {
              some: {
                userId: session.user.id,
                role: { in: ['OWNER', 'ADMIN'] },
                status: 'ACCEPTED',
              },
            },
          },
        ],
      },
      include: {
        members: true,
      },
    });

    if (!team) {
      return res.status(403).json({ error: 'You do not have permission to invite to this team' });
    }

    // Check team member limit (example: 10 members for free tier)
    const memberCount = team.members.filter((m: { status: string }) => m.status === 'ACCEPTED').length;
    if (memberCount + emails.length > 10) {
      return res.status(400).json({ error: 'Team member limit would be exceeded' });
    }

    const results = [];
    const errors = [];

    for (const email of emails) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          // Check if user already exists
          const existingUser = await tx.user.findUnique({
            where: { email: email.toLowerCase() },
          });

          // Check if already a member
          const existingMember = await tx.teamMember.findFirst({
            where: {
              teamId,
              OR: [
                { userId: existingUser?.id || '' },
                { user: { email: email.toLowerCase() } },
              ],
            },
          });

          if (existingMember) {
            if (existingMember.status === 'ACCEPTED') {
              return { type: 'error' as const, email, error: 'Already a team member' };
            } else if (existingMember.status === 'PENDING') {
              await tx.teamMember.update({
                where: { id: existingMember.id },
                data: { invitedAt: new Date(), role: assignedRole },
              });
              return { type: 'resent' as const, email };
            }
          }

          // Create invitation
          const invitation = await tx.teamMember.create({
            data: {
              teamId,
              userId: existingUser?.id || '',
              role: assignedRole,
              invitedBy: session.user.id,
              status: 'PENDING',
            },
          });

          return { type: 'invited' as const, email, invitationId: invitation.id };
        });

        if (result.type === 'error') {
          errors.push({ email: result.email, error: result.error });
        } else if (result.type === 'resent') {
          results.push({ email: result.email, status: 'resent' });
        } else {
          // Send invitation email (non-blocking — don't fail the invite if email fails)
          sendTeamInvitationEmail(
            email,
            (session.user as any).name || session.user.email || 'A team member',
            assignedRole,
            team.name,
          ).catch((err: Error) => {
            console.error(`Failed to send invitation email to ${email}:`, err.message);
          });
          results.push({ email: result.email, status: 'invited', invitationId: result.invitationId });
        }
      } catch (error) {
        console.error(`Failed to invite ${email}:`, error);
        errors.push({ email, error: 'Failed to send invitation' });
      }
    }

    return res.status(200).json({
      success: true,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Invitation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
