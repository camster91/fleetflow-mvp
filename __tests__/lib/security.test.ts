import {
  sanitizeInput,
  isValidEmail,
  validatePassword,
  validateInput,
  buildCSP,
  contentSecurityPolicy,
  auditLog,
  rateLimit,
} from '@/lib/security';
import { createMocks } from 'node-mocks-http';

jest.mock('@/lib/prisma', () => ({
  prisma: { auditLog: { create: jest.fn() } },
}))
import { prisma } from '@/lib/prisma'

describe('sanitizeInput', () => {
  it('escapes HTML special characters', () => {
    expect(sanitizeInput('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
    );
  });

  it('returns empty string unchanged', () => {
    expect(sanitizeInput('')).toBe('');
  });
});

describe('isValidEmail', () => {
  it('accepts valid email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('rejects email without @', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });

  it('rejects email exceeding 254 chars', () => {
    const long = 'a'.repeat(250) + '@b.co';
    expect(isValidEmail(long)).toBe(false);
  });
});

describe('validatePassword', () => {
  it('accepts a strong password', () => {
    const result = validatePassword('Str0ng!Pass');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects short password', () => {
    const result = validatePassword('Ab1!');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects password without uppercase', () => {
    const result = validatePassword('lowercase1!');
    expect(result.valid).toBe(false);
  });

  it('rejects password without special char', () => {
    const result = validatePassword('NoSpecial1');
    expect(result.valid).toBe(false);
  });
});

describe('validateInput', () => {
  it('fails required check for empty value', () => {
    const result = validateInput('', { required: true });
    expect(result.valid).toBe(false);
  });

  it('passes for optional empty value', () => {
    const result = validateInput('', { required: false });
    expect(result.valid).toBe(true);
  });

  it('validates email type', () => {
    expect(validateInput('bad', { type: 'email' }).valid).toBe(false);
    expect(validateInput('a@b.com', { type: 'email' }).valid).toBe(true);
  });

  it('validates string minLength', () => {
    expect(validateInput('ab', { type: 'string', minLength: 3 }).valid).toBe(false);
    expect(validateInput('abc', { type: 'string', minLength: 3 }).valid).toBe(true);
  });

  it('validates number range', () => {
    expect(validateInput(5, { type: 'number', min: 1, max: 10 }).valid).toBe(true);
    expect(validateInput(15, { type: 'number', max: 10 }).valid).toBe(false);
  });
});

describe('buildCSP', () => {
  it('builds CSP string from policy object', () => {
    const csp = buildCSP({ 'default-src': ["'self'"], 'img-src': ["'self'", 'data:'] });
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("img-src 'self' data:");
  });

  it('does not permit unsafe eval', () => {
    expect(contentSecurityPolicy['script-src']).not.toContain("'unsafe-eval'")
  })
});

describe('auditLog', () => {
  it('persists sensitive admin actions', async () => {
    await auditLog({
      type: 'USER_ROLE_CHANGED',
      userId: 'admin-1',
      targetId: 'user-2',
      details: { newRole: 'viewer' },
    })

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-1',
        action: 'USER_ROLE_CHANGED',
        entityType: 'user',
        entityId: 'user-2',
        metadata: JSON.stringify({ newRole: 'viewer' }),
      }),
    })
  })
})

describe('rateLimit client address', () => {
  it('ignores a rotating, client-controlled first X-Forwarded-For hop', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const { req, res } = createMocks({
        method: 'POST',
        headers: { 'x-forwarded-for': `10.0.0.${i}, 203.0.113.50` },
      })
      const allowed = await rateLimit(req as never, res as never, 'auth')
      statuses.push(allowed ? 200 : res._getStatusCode())
    }
    // The auth bucket allows 5; the 6th request from the same proxy-reported
    // client is limited even though the spoofed first hop changed each time.
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429])
  })
})
