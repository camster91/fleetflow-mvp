import { createMocks } from 'node-mocks-http';
import handler from '../../../pages/api/settings/profile';

jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('../../../lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn() },
  },
}));
jest.mock('../../../lib/auth', () => ({ authOptions: {} }));

import { getServerSession } from 'next-auth/next';
import { prisma } from '../../../lib/prisma';

const mockSession = { user: { id: 'user-1', email: 'test@test.com' } };
const mockUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@test.com',
  image: null,
  company: 'Acme',
  notificationPreferences: JSON.stringify({ phone: '555-9999', bio: 'Hello' }),
};

beforeEach(() => jest.clearAllMocks());

describe('GET /api/settings/profile', () => {
  it('returns 401 when unauthenticated', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(401);
  });

  it('returns user profile data', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(200);
    const d = JSON.parse(res._getData());
    expect(d.user.name).toBe('Test User');
    expect(d.user.email).toBe('test@test.com');
    expect(d.user.prefs.phone).toBe('555-9999');
  });

  it('returns 404 when user not found', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(404);
  });
});

describe('PUT /api/settings/profile', () => {
  it('updates name and company', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.user.update as jest.Mock).mockResolvedValue({
      ...mockUser,
      name: 'New Name',
      notificationPreferences: mockUser.notificationPreferences,
    });
    const { req, res } = createMocks({
      method: 'PUT',
      body: { name: 'New Name', company: 'New Co' },
    });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'New Name' }) })
    );
  });

  it('saves phone and bio in notificationPreferences JSON', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ notificationPreferences: null });
    (prisma.user.update as jest.Mock).mockResolvedValue({
      ...mockUser,
      notificationPreferences: JSON.stringify({ phone: '555-0000', bio: 'Bio text' }),
    });
    const { req, res } = createMocks({
      method: 'PUT',
      body: { phone: '555-0000', bio: 'Bio text' },
    });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(200);
    const updateCall = (prisma.user.update as jest.Mock).mock.calls[0][0];
    const savedPrefs = JSON.parse(updateCall.data.notificationPreferences);
    expect(savedPrefs.phone).toBe('555-0000');
    expect(savedPrefs.bio).toBe('Bio text');
  });

  it('returns 401 when unauthenticated', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const { req, res } = createMocks({ method: 'PUT', body: { name: 'X' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(401);
  });

  it('returns 405 for unsupported methods', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    const { req, res } = createMocks({ method: 'DELETE' });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(405);
  });
});
