import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { TeamRole } from '../../../types';

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

        const members = await prisma.teamMember.findMany({
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
        });

        return res.status(200).json({ members });
      } catch (error) {
        console.error('Failed to fetch team members:', error);
        return res.status(500).json({ error: 'Failed to fetch team members' });
      }

    case 'PUT':
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

        // Admin cannot change owner role
        if (member.role === 'OWNER' && !isOwner) {
          return res.status(403).json({ error: 'Cannot change owner role' });
        }

        // Only owner can assign admin role
        if (role === 'ADMIN' && !isOwner) {
          return res.status(403).json({ error: 'Only owner can assign admin role' });
        }

        const updatedMember = await prisma.teamMember.update({
          where: { id: memberId },
          data: { role: role as string },
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
        });

        return res.status(200).json({ member: updatedMember });
      } catch (error) {
        console.error('Failed to update member:', error);
        return res.status(500).json({ error: 'Failed to update member' });
      }

    case 'DELETE':
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
        // Admin can remove non-owners
        if (!isSelf && !isOwner) {
          const userMembership = await prisma.teamMember.findFirst({
            where: {
              teamId: member.teamId,
              userId,
              status: 'ACCEPTED',
              role: 'ADMIN',
            },
          });

          if (!userMembership || member.role === 'OWNER') {
            return res.status(403).json({ error: 'Permission denied' });
          }
        }

        // Cannot remove owner
        if (member.role === 'OWNER' && !isSelf) {
          return res.status(403).json({ error: 'Cannot remove owner' });
        }

        await prisma.teamMember.delete({
          where: { id: memberId },
        });

        return res.status(200).json({ success: true });
      } catch (error) {
        console.error('Failed to remove member:', error);
        return res.status(500).json({ error: 'Failed to remove member' });
      }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
