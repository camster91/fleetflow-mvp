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

    // Batch-load existing users for all emails
    const existingUsers = await prisma.user.findMany({
      where: { email: { in: normalizedEmails } },
      select: { id: true, email: true },
    });
    const userByEmail = new Map(existingUsers.map((u) => [u.email.toLowerCase(), u]));

    // Batch-load existing memberships for this team
    const existingMembers = await prisma.teamMember.findMany({
      where: {
        teamId,
        OR: [
          { inviteeEmail: { in: normalizedEmails } },
          { userId: { in: existingUsers.map((u) => u.id) } },
        ],
      },
    });

    const memberByEmail = new Map<string, (typeof existingMembers)[0]>();
    for (const m of existingMembers) {
      if (m.inviteeEmail) memberByEmail.set(m.inviteeEmail.toLowerCase(), m);
    }
    for (const m of existingMembers) {
      if (!m.userId) continue;
      const u = existingUsers.find((x) => x.id === m.userId);
      if (u) memberByEmail.set(u.email.toLowerCase(), m);
    }

    const results: Array<{ email: string; status: string; invitationId?: string }> = [];
    const errors: Array<{ email: string; error: string }> = [];
    const toCreate: Array<{ email: string; userId: string | null }> = [];
    const toResend: Array<{ email: string; memberId: string }> = [];

    for (const email of normalizedEmails) {
      const existing = memberByEmail.get(email);
      if (existing) {
        if (existing.status === 'ACCEPTED') {
          errors.push({ email, error: 'Already a team member' });
        } else if (existing.status === 'PENDING') {
          toResend.push({ email, memberId: existing.id });
        } else {
          toCreate.push({ email, userId: userByEmail.get(email)?.id ?? null });
        }
      } else {
        toCreate.push({ email, userId: userByEmail.get(email)?.id ?? null });
      }
    }

    // Pending invitations reserve a seat. Resends do not consume another seat.
    const occupiedSeats = team.members.filter((m) =>
      m.status === 'ACCEPTED' || m.status === 'PENDING'
    ).length;
    if (occupiedSeats + toCreate.length > 10) {
      return res.status(400).json({ error: 'Team member limit would be exceeded' });
    }

    // Single transaction for creates + resends
    await prisma.$transaction(async (tx) => {
      for (const item of toResend) {
        await tx.teamMember.update({
          where: { id: item.memberId },
          data: {
            invitedAt: new Date(),
            role: assignedRole,
            inviteeEmail: item.email,
            status: 'PENDING',
          },
        });
        results.push({ email: item.email, status: 'resent', invitationId: item.memberId });
      }

      for (const item of toCreate) {
        let invitedUserId = item.userId;
        if (!invitedUserId) {
          const invitedUser = await tx.user.upsert({
            where: { email: item.email },
            create: { email: item.email, role: 'viewer' },
            update: {},
            select: { id: true },
          });
          invitedUserId = invitedUser.id;
        }
        const invitation = await tx.teamMember.create({
          data: {
            teamId,
            userId: invitedUserId,
            inviteeEmail: item.email,
            role: assignedRole,
            invitedBy: session.user.id,
            status: 'PENDING',
          },
        });
        results.push({ email: item.email, status: 'invited', invitationId: invitation.id });
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
    console.error('Invitation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
