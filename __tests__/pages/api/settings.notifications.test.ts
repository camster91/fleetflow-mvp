import { createMocks } from 'node-mocks-http';
import handler from '../../../pages/api/settings/notifications';

// Mock next-auth
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

// Mock prisma
jest.mock('../../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock authOptions
jest.mock('../../../lib/auth', () => ({ authOptions: {} }));

import { getServerSession } from 'next-auth/next';
import { prisma } from '../../../lib/prisma';

const mockSession = { user: { id: 'user-1', email: 'test@test.com' } };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/settings/notifications', () => {
  it('returns 401 when not authenticated', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(401);
  });

  it('returns empty notificationSettings for new user', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ notificationPreferences: null });
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.notificationSettings).toEqual({});
  });

  it('returns saved notification settings', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    const saved = { vehicle_added: { email: true, push: false } };
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      notificationPreferences: JSON.stringify({ notificationSettings: saved }),
    });
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.notificationSettings).toEqual(saved);
  });

  it('returns 404 when user not found', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(404);
  });
});

describe('PUT /api/settings/notifications', () => {
  it('returns 401 when not authenticated', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const { req, res } = createMocks({ method: 'PUT', body: { notificationSettings: {} } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(401);
  });

  it('returns 400 when notificationSettings missing', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    const { req, res } = createMocks({ method: 'PUT', body: {} });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(400);
  });

  it('saves notification settings and returns success', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ notificationPreferences: null });
    (prisma.user.update as jest.Mock).mockResolvedValue({});
    const settings = { vehicle_added: { email: true, push: false } };
    const { req, res } = createMocks({ method: 'PUT', body: { notificationSettings: settings } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.success).toBe(true);
    expect(data.notificationSettings).toEqual(settings);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({ notificationPreferences: expect.any(String) }),
    });
  });

  it('merges with existing preferences (does not overwrite other fields)', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      notificationPreferences: JSON.stringify({ phone: '555-1234', otherKey: 'value' }),
    });
    (prisma.user.update as jest.Mock).mockResolvedValue({});
    const settings = { maintenance_due: { email: true, push: true } };
    const { req, res } = createMocks({ method: 'PUT', body: { notificationSettings: settings } });
    await handler(req as any, res as any);
    // Verify the saved JSON preserves existing keys
    const savedArg = (prisma.user.update as jest.Mock).mock.calls[0][0];
    const savedPrefs = JSON.parse(savedArg.data.notificationPreferences);
    expect(savedPrefs.phone).toBe('555-1234');
    expect(savedPrefs.otherKey).toBe('value');
    expect(savedPrefs.notificationSettings).toEqual(settings);
  });

  it('returns 405 for unsupported methods', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    const { req, res } = createMocks({ method: 'DELETE' });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(405);
  });
});
