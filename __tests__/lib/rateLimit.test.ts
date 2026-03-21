import {
  checkRateLimit,
  getClientIP,
  checkBruteForceProtection,
  recordFailedAttempt,
  resetBruteForceProtection,
} from '@/lib/rateLimit';

describe('getClientIP', () => {
  it('extracts IP from x-forwarded-for header', () => {
    const req = {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
      socket: { remoteAddress: '127.0.0.1' },
    } as any;
    expect(getClientIP(req)).toBe('1.2.3.4');
  });

  it('falls back to socket remoteAddress', () => {
    const req = {
      headers: {},
      socket: { remoteAddress: '10.0.0.1' },
    } as any;
    expect(getClientIP(req)).toBe('10.0.0.1');
  });

  it('returns unknown when no IP available', () => {
    const req = { headers: {}, socket: {} } as any;
    expect(getClientIP(req)).toBe('unknown');
  });
});

describe('checkRateLimit', () => {
  it('allows first request', async () => {
    const result = await checkRateLimit('api', 'test-ip-unique-1');
    expect(result.allowed).toBe(true);
  });
});

describe('brute force protection', () => {
  const id = 'brute-test-' + Date.now();

  afterEach(() => {
    resetBruteForceProtection(id);
  });

  it('allows first attempt', () => {
    const result = checkBruteForceProtection(id);
    expect(result.allowed).toBe(true);
    expect(result.attemptsRemaining).toBe(5);
  });

  it('locks after max attempts', () => {
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt(id);
    }
    const result = checkBruteForceProtection(id);
    expect(result.allowed).toBe(false);
    expect(result.attemptsRemaining).toBe(0);
  });

  it('resets after calling resetBruteForceProtection', () => {
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt(id);
    }
    resetBruteForceProtection(id);
    const result = checkBruteForceProtection(id);
    expect(result.allowed).toBe(true);
  });
});
