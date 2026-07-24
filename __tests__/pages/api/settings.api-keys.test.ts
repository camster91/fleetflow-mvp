import { createMocks } from 'node-mocks-http';

jest.mock('../../../lib/auth', () => ({
  getServerSession: jest.fn(),
  authOptions: {},
}));

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    apiKey: {
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('../../../lib/tokens', () => ({
  generateAPIKey: () => ({ key: 'ff_plaintext_once', hashedKey: 'hashed-value' }),
  hashToken: (t: string) => `hash(${t})`,
}));

import handler from '../../../pages/api/settings/api-keys';
import { getServerSession } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

beforeEach(() => jest.clearAllMocks());

describe('/api/settings/api-keys', () => {
  it('stores hashed key and returns plaintext only on create', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'u1', email: 'u@x.com', name: 'U', role: 'user' },
    });
    (prisma.apiKey.create as jest.Mock).mockResolvedValue({
      id: 'k1',
      name: 'CI',
      createdAt: new Date(),
    });

    const { req, res } = createMocks({
      method: 'POST',
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      body: { name: 'CI' },
    });

    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(201);
    expect(prisma.apiKey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ key: 'hashed-value' }),
      })
    );
    const body = JSON.parse(res._getData());
    expect(body.apiKey.key).toBe('ff_plaintext_once');
  });

  it('never returns stored key material on list', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'u1', email: 'u@x.com', name: 'U', role: 'user' },
    });
    (prisma.apiKey.findMany as jest.Mock).mockResolvedValue([
      { id: 'k1', name: 'CI', key: 'hashed-value', createdAt: new Date(), lastUsedAt: null },
    ]);

    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res as any);
    const body = JSON.parse(res._getData());
    expect(body.keys[0].key).toMatch(/•/);
    expect(body.keys[0].key).not.toContain('hashed-value');
  });
});
