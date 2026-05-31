import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession, authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });
  const userId = (session.user as any).id;

  if (req.method === 'GET') {
    // Find team membership
    const membership = await prisma.teamMember.findFirst({
      where: { userId, status: 'ACCEPTED' },
      include: {
        team: {
          include: {
            members: {
              include: { user: { select: { id: true, name: true, email: true, image: true, role: true, createdAt: true } } },
            },
          },
        },
      },
    });

    if (!membership) {
      // Solo user
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, image: true, createdAt: true },
      });
      return res.json([{ id: userId, role: 'OWNER', status: 'ACCEPTED', invitedAt: user?.createdAt, joinedAt: user?.createdAt, user, invitedByUser: null, isSelf: true }]);
    }

    const members = membership.team.members.map(m => ({
      id: m.id,
      role: m.role,
      status: m.status,
      invitedAt: (m as any).createdAt,
      joinedAt: m.status === 'ACCEPTED' ? (m as any).updatedAt : null,
      user: m.user ?? null,
      invitedByUser: null,
      isSelf: m.userId === userId,
    }));

    return res.json(members);
  }

  if (req.method === 'PUT') {
    // Change role: { memberId, role }
    const { memberId, role } = req.body;
    try {
      await prisma.teamMember.update({ where: { id: memberId }, data: { role } });
      return res.json({ success: true });
    } catch { return res.status(400).json({ error: 'Failed to update role' }); }
  }

  if (req.method === 'DELETE') {
    const { memberId } = req.body;
    try {
      await prisma.teamMember.delete({ where: { id: memberId } });
      return res.json({ success: true });
    } catch { return res.status(400).json({ error: 'Failed to remove member' }); }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
