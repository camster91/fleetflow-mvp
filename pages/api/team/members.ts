import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession, authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { TeamRole } from '../../../types';
import { clearDriverAssignments } from '../../../lib/teamDriverCleanup';
import { assertSameOrigin } from '../../../lib/apiAuth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  switch (req.method) {
    case 'GET':
      try {
        const { teamId } = req.query;

        if (!teamId || typeof teamId !== 'string') {
          return res.status(400).json({ error: 'Team ID required' });
        }

        // Check if user is a member of this team
        const membership = await prisma.teamMember.findFirst({
          where: {
            teamId,
            userId,
            status: 'ACCEPTED',
          },
        });

        const team = await prisma.team.findFirst({
          where: {
            id: teamId,
            OR: [
              { ownerId: userId },
              { members: { some: { userId, status: 'ACCEPTED' } } },
            ],
          },
        });

        if (!team) {
          return res.status(403).json({ error: 'Access denied' });
        }

        const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
        const skip = (page - 1) * limit;

        const [members, total] = await Promise.all([
          prisma.teamMember.findMany({
            where: { teamId },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
            orderBy: [
              { role: 'asc' },
              { invitedAt: 'desc' },
            ],
            skip,
            take: limit,
          }),
          prisma.teamMember.count({ where: { teamId } }),
        ]);

        return res.status(200).json({ members, total, page, limit, hasMore: skip + limit < total });
      } catch (error) {
        console.error('Failed to fetch team members:', error);
        return res.status(500).json({ error: 'Failed to fetch team members' });
      }

    case 'PUT':
      if (!assertSameOrigin(req, res)) return;
      try {
        const { memberId, role } = req.body;

        if (!memberId || !role) {
          return res.status(400).json({ error: 'Member ID and role required' });
        }

        // Get the member being updated
        const member = await prisma.teamMember.findUnique({
          where: { id: memberId },
          include: { team: true },
        });

        if (!member) {
          return res.status(404).json({ error: 'Member not found' });
        }

        const validRoles = ['ADMIN', 'MANAGER', 'DISPATCHER', 'TECHNICIAN', 'DRIVER', 'MEMBER', 'VIEWER'];
        if (!validRoles.includes(role)) {
          return res.status(400).json({ error: 'Invalid role' });
        }

        // Check if user has permission to update roles
        const userMembership = await prisma.teamMember.findFirst({
          where: {
            teamId: member.teamId,
            userId,
            status: 'ACCEPTED',
          },
        });

        const isOwner = member.team.ownerId === userId;
        const isAdmin = userMembership?.role === 'ADMIN';

        if (!isOwner && !isAdmin) {
          return res.status(403).json({ error: 'Permission denied' });
        }

        // Ownership is canonical in Team.ownerId and requires a dedicated
        // transfer operation; it cannot be changed through membership roles.
        if (member.team.ownerId === member.userId || member.role === 'OWNER') {
          return res.status(403).json({ error: 'Cannot change owner role' });
        }

        // Admins are peers: only the owner may change an admin's role.
        if (member.role === 'ADMIN' && !isOwner) {
          return res.status(403).json({ error: 'Only the owner can change an admin role' });
        }

        // Only owner can assign admin role
        if (role === 'ADMIN' && !isOwner) {
          return res.status(403).json({ error: 'Only owner can assign admin role' });
        }

        const updatedMember = await prisma.$transaction(async tx=>{const updated=await tx.teamMember.update({where:{id:memberId},data:{role:role as string},include:{user:{select:{id:true,name:true,email:true,image:true}}}});if(member.role==='DRIVER'&&role!=='DRIVER')await clearDriverAssignments(tx,member.teamId,member.userId,{actorId:userId,actorName:session.user.name,actorRole:isOwner?'OWNER':userMembership?.role});return updated});

        return res.status(200).json({ member: updatedMember });
      } catch (error) {
        console.error('Failed to update member:', error);
        return res.status(500).json({ error: 'Failed to update member' });
      }

    case 'DELETE':
      if (!assertSameOrigin(req, res)) return;
      try {
        const { memberId } = req.query;

        if (!memberId || typeof memberId !== 'string') {
          return res.status(400).json({ error: 'Member ID required' });
        }

        // Get the member being deleted
        const member = await prisma.teamMember.findUnique({
          where: { id: memberId },
          include: { team: true },
        });

        if (!member) {
          return res.status(404).json({ error: 'Member not found' });
        }

        // Check permissions
        const isOwner = member.team.ownerId === userId;
        const isSelf = member.userId === userId;

        // User can remove themselves
        // Owner can remove anyone
        // Admin can remove non-owner, non-admin members
        if (!isSelf && !isOwner) {
          const userMembership = await prisma.teamMember.findFirst({
            where: {
              teamId: member.teamId,
              userId,
              status: 'ACCEPTED',
              role: 'ADMIN',
            },
          });

          // Admins are peers: only the owner may remove another admin.
          if (!userMembership || member.role === 'OWNER' || member.role === 'ADMIN') {
            return res.status(403).json({ error: 'Permission denied' });
          }
        }

        // Cannot remove the canonical owner or a legacy OWNER-labelled member.
        if (member.team.ownerId === member.userId || member.role === 'OWNER') {
          return res.status(403).json({ error: 'Cannot remove owner' });
        }

        await prisma.$transaction(async tx=>{await clearDriverAssignments(tx,member.teamId,member.userId,{actorId:userId,actorName:session.user.name,actorRole:isOwner?'OWNER':'ADMIN'});await tx.teamMember.delete({where:{id:memberId}})});

        return res.status(200).json({ success: true });
      } catch (error) {
        console.error('Failed to remove member:', error);
        return res.status(500).json({ error: 'Failed to remove member' });
      }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
