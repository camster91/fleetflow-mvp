import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession, authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { sendTeamInvitationEmail } from '../../../lib/email';
import { assertSameOrigin } from '../../../lib/apiAuth';
import { parseBody, teamInviteSchema } from '../../../lib/validation';
import { canAssignRole } from '../../../lib/permissions';
import type { TeamRole } from '../../../types';

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

  if (!assertSameOrigin(req, res)) return;

  try {
    const parsed = parseBody(teamInviteSchema, req.body);
    if ('error' in parsed) {
      return res.status(400).json({ error: parsed.error });
    }

    const { teamId, emails, role } = parsed.data;
    const assignedRole = role || 'MEMBER';
    const normalizedEmails = [...new Set(emails.map((e) => e.toLowerCase()))];

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

    const assignerRole: TeamRole | undefined = team.ownerId === session.user.id
      ? 'OWNER'
      : team.members.find((member) => member.userId === session.user.id && member.status === 'ACCEPTED')?.role as TeamRole | undefined;
    if (!assignerRole || !canAssignRole(assignerRole, assignedRole)) {
      return res.status(403).json({ error: 'You do not have permission to assign this role' });
    }

    const results: Array<{ email: string; status: string; invitationId?: string }> = [];
    const errors: Array<{ email: string; error: string }> = [];

    // Serialize invitation provisioning per team. The advisory lock and all
    // capacity reads/writes share one transaction, so concurrent requests
    // cannot both reserve the same final seat.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${teamId}, 0))`;

      const existingUsers = await tx.user.findMany({
        where: { email: { in: normalizedEmails } },
        select: { id: true, email: true },
      });
      const userByEmail = new Map(existingUsers.map((u) => [u.email.toLowerCase(), u]));

      const existingMembers = await tx.teamMember.findMany({
        where: {
          teamId,
          OR: [
            { inviteeEmail: { in: normalizedEmails } },
            { userId: { in: existingUsers.map((u) => u.id) } },
          ],
        },
      });
      const memberByEmail = new Map<string, (typeof existingMembers)[0]>();
      for (const member of existingMembers) {
        if (member.inviteeEmail) memberByEmail.set(member.inviteeEmail.toLowerCase(), member);
        if (member.userId) {
          const user = existingUsers.find((candidate) => candidate.id === member.userId);
          if (user) memberByEmail.set(user.email.toLowerCase(), member);
        }
      }

      const actions = normalizedEmails.map((email) => {
        const member = memberByEmail.get(email);
        if (member?.status === 'ACCEPTED') return { email, kind: 'accepted' as const, member };
        if (member?.status === 'PENDING') return { email, kind: 'resend' as const, member };
        if (member) return { email, kind: 'reactivate' as const, member };
        return { email, kind: 'create' as const, member: undefined };
      });

      for (const action of actions) {
        if (action.kind === 'accepted') {
          errors.push({ email: action.email, error: 'Already a team member' });
        }
      }

      const occupiedSeats = await tx.teamMember.count({
        where: { teamId, status: { in: ['ACCEPTED', 'PENDING'] } },
      });
      const seatsToReserve = actions.filter(
        (action) => action.kind === 'create' || action.kind === 'reactivate'
      ).length;
      if (occupiedSeats + seatsToReserve > 10) {
        throw new Error('TEAM_SEAT_LIMIT_EXCEEDED');
      }

      for (const action of actions) {
        if (action.kind === 'accepted') continue;

        if (action.kind === 'resend' || action.kind === 'reactivate') {
          const updated = await tx.teamMember.update({
            where: { id: action.member.id },
            data: {
              invitedAt: new Date(),
              role: assignedRole,
              inviteeEmail: action.email,
              status: 'PENDING',
            },
          });
          results.push({
            email: action.email,
            status: action.kind === 'resend' ? 'resent' : 'invited',
            invitationId: updated.id,
          });
          continue;
        }

        let invitedUserId = userByEmail.get(action.email)?.id;
        if (!invitedUserId) {
          const invitedUser = await tx.user.upsert({
            where: { email: action.email },
            create: { email: action.email, role: 'viewer' },
            update: {},
            select: { id: true },
          });
          invitedUserId = invitedUser.id;
        }
        const invitation = await tx.teamMember.create({
          data: {
            teamId,
            userId: invitedUserId,
            inviteeEmail: action.email,
            role: assignedRole,
            invitedBy: session.user.id,
            status: 'PENDING',
          },
        });
        results.push({ email: action.email, status: 'invited', invitationId: invitation.id });
      }
    });

    // Fire-and-forget emails in parallel (don't block response)
    const inviterName =
      (session.user as { name?: string | null }).name || session.user.email || 'A team member';
    await Promise.allSettled(
      results.map((r) =>
        sendTeamInvitationEmail(r.email, inviterName, assignedRole, team.name, r.invitationId!).catch((err: Error) => {
          console.error(`Failed to send invitation email to ${r.email}:`, err.message);
        })
      )
    );

    return res.status(200).json({
      success: true,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'TEAM_SEAT_LIMIT_EXCEEDED') {
      return res.status(400).json({ error: 'Team member limit would be exceeded' });
    }
    console.error('Invitation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
