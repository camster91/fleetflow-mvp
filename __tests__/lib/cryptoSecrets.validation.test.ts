import { encryptSecret, decryptSecret, isEncryptedSecret } from '../../lib/cryptoSecrets';
import { hashToken } from '../../lib/tokens';
import { parseBody, teamInviteSchema, vehicleBodySchema } from '../../lib/validation';

describe('cryptoSecrets', () => {
  it('round-trips secrets', () => {
    process.env.JWT_SECRET = 'test-secret-for-unit-tests-32chars!!';
    const plain = 'JBSWY3DPEHPK3PXP';
    const enc = encryptSecret(plain);
    expect(isEncryptedSecret(enc)).toBe(true);
    expect(decryptSecret(enc)).toBe(plain);
  });

  it('accepts legacy plaintext', () => {
    expect(decryptSecret('LEGACYSECRET')).toBe('LEGACYSECRET');
  });
});

describe('hashToken', () => {
  it('is deterministic and not reversible plaintext', () => {
    const a = hashToken('abc');
    const b = hashToken('abc');
    expect(a).toBe(b);
    expect(a).not.toBe('abc');
    expect(a).toHaveLength(64);
  });
});

describe('validation schemas', () => {
  it('accepts valid team invite payload', () => {
    const result = parseBody(teamInviteSchema, {
      teamId: 'clxxxxxxxxxxxxxxxxxxxx',
      emails: ['A@Example.com', 'b@example.com'],
      role: 'MEMBER',
    });
    expect('data' in result).toBe(true);
    if ('data' in result) {
      expect(result.data.emails).toEqual(['a@example.com', 'b@example.com']);
    }
  });

  it('rejects invalid vehicle status', () => {
    const result = parseBody(vehicleBodySchema, { status: 'flying' });
    expect('error' in result).toBe(true);
  });
});
