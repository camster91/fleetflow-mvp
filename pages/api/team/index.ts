import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import {
  requireSession,
  assertSameOrigin,
  getTeamMemberManageContext,
} from '../../../lib/apiAuth';
import { canAssignRole } from '../../../lib/permissions';
import type { TeamRole } from '../../../types';
import { clearDriverAssignments } from '../../../lib/teamDriverCleanup';

const ASSIGNABLE_ROLES: TeamRole[] = ['ADMIN', 'MANAGER', 'DISPATCHER', 'TECHNICIAN', 'DRIVER', 'MEMBER', 'VIEWER'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) return;
  const userId = session.user.id;

  if (req.method === 'GET') {
    const membership = await prisma.teamMember.findFirst({
      where: { userId, status: 'ACCEPTED' },
      include: {
        team: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, image: true, role: true, createdAt: true },
                },
              },
            },
          },
        },
      },
    });

    if (!membership) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, image: true, createdAt: true },
      });
      return res.json([
        {
          id: userId,
          role: 'OWNER',
          status: 'ACCEPTED',
          invitedAt: user?.createdAt,
          joinedAt: user?.createdAt,
          user,
          invitedByUser: null,
          isSelf: true,
        },
      ]);
    }

    const members = membership.team.members.map((m) => ({
      id: m.id,
      role: m.role,
      status: m.status,
      invitedAt: m.invitedAt,
      joinedAt: m.joinedAt,
      user: m.user ?? null,
      invitedByUser: null,
      isSelf: m.userId === userId,
    }));

    return res.json(members);
  }

  if (req.method === 'PUT') {
    if (!assertSameOrigin(req, res)) return;

    const { memberId, role } = req.body || {};
    if (!memberId || typeof memberId !== 'string' || !role || typeof role !== 'string') {
      return res.status(400).json({ error: 'memberId and role are required' });
    }
    if (!ASSIGNABLE_ROLES.includes(role as TeamRole)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const ctx = await getTeamMemberManageContext(userId, memberId);
    if (!ctx) return res.status(404).json({ error: 'Member not found' });
    if (!ctx.canManage) return res.status(403).json({ error: 'Permission denied' });

    // Ownership is canonical in Team.ownerId. It cannot be transferred or
    // changed through the ordinary membership-role endpoint.
    if (ctx.member.team.ownerId === ctx.member.userId) {
      return res.status(403).json({ error: 'Cannot change owner role' });
    }

    // Admins are peers: only the owner may change an admin's role.
    if (!ctx.isOwner && ctx.member.role === 'ADMIN') {
      return res.status(403).json({ error: 'Only the owner can change an admin role' });
    }

    const assignerRole = (ctx.isOwner ? 'OWNER' : ctx.userMembership?.role) as TeamRole;
    if (!canAssignRole(assignerRole, role as TeamRole)) {
      return res.status(403).json({ error: 'Cannot assign this role' });
    }

    try {
      await prisma.$transaction(async tx=>{await tx.teamMember.update({ where: { id: memberId }, data: { role } });if(ctx.member.role==='DRIVER'&&role!=='DRIVER')await clearDriverAssignments(tx,ctx.member.teamId,ctx.member.userId,{actorId:userId,actorName:session.user.name,actorRole:assignerRole})});
      return res.json({ success: true });
    } catch {
      return res.status(400).json({ error: 'Failed to update role' });
    }
  }

  if (req.method === 'DELETE') {
    if (!assertSameOrigin(req, res)) return;

    const { memberId } = req.body || {};
    if (!memberId || typeof memberId !== 'string') {
      return res.status(400).json({ error: 'memberId is required' });
    }

    const ctx = await getTeamMemberManageContext(userId, memberId);
    if (!ctx) return res.status(404).json({ error: 'Member not found' });

    const isSelf = ctx.member.userId === userId;
    if (ctx.member.team.ownerId === ctx.member.userId) {
      return res.status(403).json({ error: 'Cannot remove owner' });
    }
    if (!isSelf && !ctx.canManage) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    // Admins are peers: only the owner may remove another admin.
    if (!isSelf && !ctx.isOwner && ctx.member.role === 'ADMIN') {
      return res.status(403).json({ error: 'Only the owner can remove an admin' });
    }
    // Reject legacy/inconsistent OWNER labels as well.
    if (ctx.member.role === 'OWNER') {
      return res.status(403).json({ error: 'Cannot remove owner' });
    }

    try {
      await prisma.$transaction(async tx=>{await clearDriverAssignments(tx,ctx.member.teamId,ctx.member.userId,{actorId:userId,actorName:session.user.name,actorRole:ctx.isOwner?'OWNER':ctx.userMembership?.role});await tx.teamMember.delete({ where: { id: memberId } })});
      return res.json({ success: true });
    } catch {
      return res.status(400).json({ error: 'Failed to remove member' });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
