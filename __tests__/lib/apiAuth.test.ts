import { assertSameOrigin, isTeamInviteExpired, TEAM_INVITE_TTL_MS } from '../../lib/apiAuth';

function mockRes() {
  const res: any = {
    statusCode: 200,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('assertSameOrigin', () => {
  const prev = process.env.NODE_ENV;
  const mutableEnv = process.env as Record<string, string | undefined>;

  afterEach(() => {
    mutableEnv.NODE_ENV = prev;
  });

  it('allows matching Origin', () => {
    mutableEnv.NODE_ENV = 'production';
    const res = mockRes();
    const ok = assertSameOrigin(
      { method: 'POST', headers: { host: 'fleet.ashbi.ca', origin: 'https://fleet.ashbi.ca' } } as any,
      res
    );
    expect(ok).toBe(true);
  });

  it('rejects mismatched Origin in production', () => {
    mutableEnv.NODE_ENV = 'production';
    const res = mockRes();
    const ok = assertSameOrigin(
      { method: 'POST', headers: { host: 'fleet.ashbi.ca', origin: 'https://evil.example' } } as any,
      res
    );
    expect(ok).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it('rejects missing Origin/Referer in production', () => {
    mutableEnv.NODE_ENV = 'production';
    const res = mockRes();
    const ok = assertSameOrigin(
      { method: 'DELETE', headers: { host: 'fleet.ashbi.ca' } } as any,
      res
    );
    expect(ok).toBe(false);
  });
});

describe('isTeamInviteExpired', () => {
  it('expires after TTL', () => {
    const fresh = new Date();
    const old = new Date(Date.now() - TEAM_INVITE_TTL_MS - 1000);
    expect(isTeamInviteExpired(fresh)).toBe(false);
    expect(isTeamInviteExpired(old)).toBe(true);
  });
});
