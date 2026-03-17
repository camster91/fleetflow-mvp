import { createMocks } from 'node-mocks-http';
import handler from '../../../pages/api/team/resend-invite';

jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('../../../lib/prisma', () => ({
  prisma: {
    teamMember: { findUnique: jest.fn(), findFirst: jest.fn() },
  },
}));
jest.mock('../../../lib/auth', () => ({ authOptions: {} }));
jest.mock('../../../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

import { getServerSession } from 'next-auth/next';
import { prisma } from '../../../lib/prisma';
import { sendEmail } from '../../../services/emailService';

const mockSession = { user: { id: 'user-owner' } };

beforeEach(() => jest.clearAllMocks());

describe('POST /api/team/resend-invite', () => {
  it('returns 405 for non-POST', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(405);
  });

  it('returns 401 when unauthenticated', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const { req, res } = createMocks({ method: 'POST', body: { memberId: 'm1' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(401);
  });

  it('returns 400 when memberId missing', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    const { req, res } = createMocks({ method: 'POST', body: {} });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(400);
  });

  it('returns 404 when member not found', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue(null);
    const { req, res } = createMocks({ method: 'POST', body: { memberId: 'nonexistent' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(404);
  });

  it('returns 400 when invite is not PENDING', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({
      id: 'm1', status: 'ACCEPTED', teamId: 't1',
      team: { name: 'Team A' },
      user: { email: 'user@test.com', name: 'User' },
    });
    const { req, res } = createMocks({ method: 'POST', body: { memberId: 'm1' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(400);
  });

  it('returns 403 when requester not in same team', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({
      id: 'm1', status: 'PENDING', teamId: 't1',
      team: { name: 'Team A' },
      user: { email: 'invitee@test.com', name: 'Invitee' },
      invitationToken: 'tok123', invitedEmail: 'invitee@test.com',
    });
    (prisma.teamMember.findFirst as jest.Mock).mockResolvedValue(null);
    const { req, res } = createMocks({ method: 'POST', body: { memberId: 'm1' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(403);
  });

  it('sends email and returns success', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({
      id: 'm1', status: 'PENDING', teamId: 't1',
      team: { name: 'Acme Fleet' },
      user: { email: 'invitee@test.com', name: 'Invitee' },
      invitationToken: 'tok123', invitedEmail: 'invitee@test.com',
    });
    (prisma.teamMember.findFirst as jest.Mock).mockResolvedValue({ id: 'owner-m' });
    const { req, res } = createMocks({ method: 'POST', body: { memberId: 'm1' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(200);
    const d = JSON.parse(res._getData());
    expect(d.success).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'invitee@test.com', subject: expect.stringContaining('Acme Fleet') })
    );
  });
});
