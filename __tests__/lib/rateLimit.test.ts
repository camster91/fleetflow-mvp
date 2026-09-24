import {
  checkRateLimit,
  getClientIP,
  checkBruteForceProtection,
  recordFailedAttempt,
  resetBruteForceProtection,
} from '@/lib/rateLimit';

describe('getClientIP', () => {
  const originalHops = process.env.TRUSTED_PROXY_HOPS;
  afterEach(() => {
    if (originalHops === undefined) delete process.env.TRUSTED_PROXY_HOPS;
    else process.env.TRUSTED_PROXY_HOPS = originalHops;
  });

  it('takes the hop appended by the single trusted proxy by default', () => {
    delete process.env.TRUSTED_PROXY_HOPS;
    const req = {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
      socket: { remoteAddress: '127.0.0.1' },
    } as any;
    expect(getClientIP(req)).toBe('5.6.7.8');
  });

  it('ignores a spoofed left-most X-Forwarded-For entry', () => {
    delete process.env.TRUSTED_PROXY_HOPS;
    const spoofed = {
      headers: { 'x-forwarded-for': '9.9.9.9, 198.51.100.7' },
      socket: { remoteAddress: '10.0.0.2' },
    } as any;
    const other = {
      headers: { 'x-forwarded-for': '8.8.8.8, 198.51.100.7' },
      socket: { remoteAddress: '10.0.0.2' },
    } as any;
    expect(getClientIP(spoofed)).toBe('198.51.100.7');
    expect(getClientIP(other)).toBe('198.51.100.7');
  });

  it('walks TRUSTED_PROXY_HOPS entries from the right', () => {
    process.env.TRUSTED_PROXY_HOPS = '2';
    const req = {
      headers: { 'x-forwarded-for': ['9.9.9.9, 1.2.3.4', '172.16.0.1'] },
      socket: { remoteAddress: '10.0.0.2' },
    } as any;
    expect(getClientIP(req)).toBe('1.2.3.4');
  });

  it('uses the socket peer and ignores the header when TRUSTED_PROXY_HOPS=0', () => {
    process.env.TRUSTED_PROXY_HOPS = '0';
    const req = {
      headers: { 'x-forwarded-for': '1.2.3.4' },
      socket: { remoteAddress: '10.0.0.1' },
    } as any;
    expect(getClientIP(req)).toBe('10.0.0.1');
  });

  it('falls back to the left-most entry when fewer hops than configured exist', () => {
    process.env.TRUSTED_PROXY_HOPS = '5';
    const req = {
      headers: { 'x-forwarded-for': '1.2.3.4' },
      socket: { remoteAddress: '10.0.0.1' },
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
