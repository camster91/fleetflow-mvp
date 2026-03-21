import {
  sanitizeInput,
  isValidEmail,
  validatePassword,
  validateInput,
  buildCSP,
  contentSecurityPolicy,
} from '@/lib/security';

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
});
