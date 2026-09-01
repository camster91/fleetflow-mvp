import { createMocks } from 'node-mocks-http';

jest.mock('../../../lib/auth', () => ({
  getServerSession: jest.fn(),
  authOptions: {},
}));

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(async (callback: any) => callback((await import('../../../lib/prisma')).prisma)),
    teamMember: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    team: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
    vehicle: { updateMany: jest.fn().mockResolvedValue({count:0}) },
    delivery: { updateMany: jest.fn().mockResolvedValue({count:0}) },
  },
}));

import handler from '../../../pages/api/team/index';
import { getServerSession } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

beforeEach(() => jest.clearAllMocks());

describe('PUT/DELETE /api/team — authorization', () => {
  it('rejects unauthenticated PUT', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const { req, res } = createMocks({
      method: 'PUT',
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      body: { memberId: 'm1', role: 'ADMIN' },
    });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(401);
  });

  it('forbids role change without manage permission', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', email: 'a@b.com', name: 'A', role: 'user' },
    });
    (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({
      id: 'm1',
      teamId: 't1',
      role: 'MEMBER',
      userId: 'other',
      team: { ownerId: 'owner-1' },
    });
    (prisma.teamMember.findFirst as jest.Mock).mockResolvedValue({
      role: 'MEMBER',
      status: 'ACCEPTED',
    });

    const { req, res } = createMocks({
      method: 'PUT',
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      body: { memberId: 'm1', role: 'ADMIN' },
    });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(403);
    expect(prisma.teamMember.update).not.toHaveBeenCalled();
  });

  it('allows owner to update member role', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'owner-1', email: 'o@b.com', name: 'O', role: 'admin' },
    });
    (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({
      id: 'm1',
      teamId: 't1',
      role: 'MEMBER',
      userId: 'other',
      team: { ownerId: 'owner-1' },
    });
    (prisma.teamMember.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.teamMember.update as jest.Mock).mockResolvedValue({ id: 'm1', role: 'MANAGER' });

    const { req, res } = createMocks({
      method: 'PUT',
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      body: { memberId: 'm1', role: 'MANAGER' },
    });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(200);
    expect(prisma.teamMember.update).toHaveBeenCalled();
  });

  it('rejects OWNER as an ordinary assignable role', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'owner-1', email: 'o@b.com', name: 'O', role: 'admin' },
    });
    const { req, res } = createMocks({
      method: 'PUT',
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      body: { memberId: 'm1', role: 'OWNER' },
    });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
    expect(prisma.teamMember.update).not.toHaveBeenCalled();
  });

  it('protects the canonical owner even when its membership role has drifted', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'owner-1', email: 'o@b.com', name: 'O', role: 'admin' },
    });
    (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({
      id: 'owner-membership',
      teamId: 't1',
      role: 'ADMIN',
      userId: 'owner-1',
      team: { ownerId: 'owner-1' },
    });
    (prisma.teamMember.findFirst as jest.Mock).mockResolvedValue(null);

    const { req, res } = createMocks({
      method: 'PUT',
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      body: { memberId: 'owner-membership', role: 'MEMBER' },
    });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(403);
    expect(prisma.teamMember.update).not.toHaveBeenCalled();
  });

  it('forbids deleting arbitrary members without permission', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', email: 'a@b.com', name: 'A', role: 'user' },
    });
    (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({
      id: 'm1',
      teamId: 't1',
      role: 'MEMBER',
      userId: 'victim',
      team: { ownerId: 'owner-1' },
    });
    (prisma.teamMember.findFirst as jest.Mock).mockResolvedValue({
      role: 'VIEWER',
      status: 'ACCEPTED',
    });

    const { req, res } = createMocks({
      method: 'DELETE',
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      body: { memberId: 'm1' },
    });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(403);
    expect(prisma.teamMember.delete).not.toHaveBeenCalled();
  });
});
