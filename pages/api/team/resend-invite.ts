import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { sendEmail } from '../../../services/emailService';

/** POST /api/team/resend-invite -- body: { memberId } */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });
  const requesterId = (session.user as any).id;

  const { memberId } = req.body;
  if (!memberId) return res.status(400).json({ error: 'memberId required' });

  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
    include: {
      team: { select: { name: true } },
      user: { select: { email: true, name: true } },
    },
  });

  if (!member) return res.status(404).json({ error: 'Invitation not found' });
  if (member.status !== 'PENDING') return res.status(400).json({ error: 'Invitation is not pending' });

  // Verify requester belongs to the same team
  const requesterMembership = await prisma.teamMember.findFirst({
    where: { userId: requesterId, teamId: member.teamId, status: 'ACCEPTED' },
  });
  if (!requesterMembership) return res.status(403).json({ error: 'Forbidden' });

  const inviteToken = member.id; // token IS the member id
  const inviteUrl = `${process.env.NEXTAUTH_URL}/accept-invite/${inviteToken}`;
  const inviteeName = member.user?.name || 'Team Member';
  const inviteeEmail = member.user?.email;

  if (!inviteeEmail) return res.status(400).json({ error: 'No email address for this invite' });

  try {
    await sendEmail({
      to: inviteeEmail,
      subject: `Reminder: You have been invited to join ${member.team.name}`,
      html: `
        <h2>You have a pending invitation</h2>
        <p>Hi ${inviteeName},</p>
        <p>This is a reminder that you have been invited to join <strong>${member.team.name}</strong> on FleetFlow.</p>
        <p><a href="${inviteUrl}" style="background:#1e40af;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">Accept Invitation</a></p>
        <p>This link will expire 7 days from when it was first sent.</p>
      `,
    });
    return res.json({ success: true, message: 'Invitation resent successfully' });
  } catch (err) {
    console.error('Failed to send invite email:', err);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
