import { verifyToken, signToken, hashPassword, verifyPassword } from '@/lib/auth';

// Mock prisma so importing auth doesn't blow up
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
  },
}));

describe('signToken / verifyToken', () => {
  it('returns payload for a valid token', () => {
    const token = signToken({ sub: 'u1', email: 'a@b.com', name: 'A', role: 'user' });
    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe('u1');
    expect(payload!.email).toBe('a@b.com');
  });

  it('returns null for an invalid token', () => {
    expect(verifyToken('bad.token.here')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(verifyToken('')).toBeNull();
  });
});

describe('hashPassword / verifyPassword', () => {
  it('hashes and verifies correctly', async () => {
    const hash = await hashPassword('SecureP@ss1');
    expect(hash).not.toBe('SecureP@ss1');
    expect(await verifyPassword('SecureP@ss1', hash)).toBe(true);
  });

  it('rejects wrong password', async () => {
    const hash = await hashPassword('SecureP@ss1');
    expect(await verifyPassword('WrongPass', hash)).toBe(false);
  });
});
