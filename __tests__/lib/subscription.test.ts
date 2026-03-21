import {
  hasActiveSubscription,
  isInTrial,
  isCancelled,
  getTrialDaysLeft,
  isPastDue,
  hasTrialExpired,
  canAccessFeature,
  Subscription,
} from '@/lib/subscription';

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-1',
    userId: 'user-1',
    plan: 'PER_USER',
    status: 'ACTIVE',
    cancelAtPeriodEnd: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('hasActiveSubscription', () => {
  it('returns false for null subscription', () => {
    expect(hasActiveSubscription(null)).toBe(false);
  });

  it('returns true for ACTIVE status', () => {
    expect(hasActiveSubscription(makeSub({ status: 'ACTIVE' }))).toBe(true);
  });

  it('returns true for TRIAL status', () => {
    expect(hasActiveSubscription(makeSub({ status: 'TRIAL' }))).toBe(true);
  });

  it('returns true for CANCELLED with future period end', () => {
    const future = new Date(Date.now() + 86400000);
    expect(
      hasActiveSubscription(makeSub({ status: 'CANCELLED', currentPeriodEnd: future }))
    ).toBe(true);
  });

  it('returns false for CANCELLED with past period end', () => {
    const past = new Date(Date.now() - 86400000);
    expect(
      hasActiveSubscription(makeSub({ status: 'CANCELLED', currentPeriodEnd: past }))
    ).toBe(false);
  });

  it('returns false for PAST_DUE status', () => {
    expect(hasActiveSubscription(makeSub({ status: 'PAST_DUE' }))).toBe(false);
  });

  it('returns false for UNPAID status', () => {
    expect(hasActiveSubscription(makeSub({ status: 'UNPAID' }))).toBe(false);
  });
});

describe('isInTrial', () => {
  it('returns false for null', () => {
    expect(isInTrial(null)).toBe(false);
  });

  it('returns true when status is TRIAL', () => {
    expect(isInTrial(makeSub({ status: 'TRIAL' }))).toBe(true);
  });

  it('returns false when status is ACTIVE', () => {
    expect(isInTrial(makeSub({ status: 'ACTIVE' }))).toBe(false);
  });
});

describe('getTrialDaysLeft', () => {
  it('returns 0 for null subscription', () => {
    expect(getTrialDaysLeft(null)).toBe(0);
  });

  it('returns 0 when not in trial', () => {
    expect(getTrialDaysLeft(makeSub({ status: 'ACTIVE' }))).toBe(0);
  });

  it('returns 0 when trialEndsAt is missing', () => {
    expect(getTrialDaysLeft(makeSub({ status: 'TRIAL' }))).toBe(0);
  });

  it('returns positive days when trial is active', () => {
    const trialEndsAt = new Date(Date.now() + 5 * 86400000);
    const days = getTrialDaysLeft(makeSub({ status: 'TRIAL', trialEndsAt }));
    expect(days).toBeGreaterThanOrEqual(4);
    expect(days).toBeLessThanOrEqual(6);
  });

  it('returns 0 when trial has expired', () => {
    const trialEndsAt = new Date(Date.now() - 86400000);
    expect(getTrialDaysLeft(makeSub({ status: 'TRIAL', trialEndsAt }))).toBe(0);
  });
});

describe('isCancelled', () => {
  it('returns false for null', () => {
    expect(isCancelled(null)).toBe(false);
  });

  it('returns true for CANCELLED status', () => {
    expect(isCancelled(makeSub({ status: 'CANCELLED' }))).toBe(true);
  });

  it('returns true when cancelAtPeriodEnd is true', () => {
    expect(isCancelled(makeSub({ cancelAtPeriodEnd: true }))).toBe(true);
  });

  it('returns false for active non-cancelling subscription', () => {
    expect(isCancelled(makeSub({ status: 'ACTIVE', cancelAtPeriodEnd: false }))).toBe(false);
  });
});

describe('isPastDue', () => {
  it('returns false for null', () => {
    expect(isPastDue(null)).toBe(false);
  });

  it('returns true for PAST_DUE status', () => {
    expect(isPastDue(makeSub({ status: 'PAST_DUE' }))).toBe(true);
  });
});

describe('hasTrialExpired', () => {
  it('returns false for null', () => {
    expect(hasTrialExpired(null)).toBe(false);
  });

  it('returns true when trial end date is in the past', () => {
    const trialEndsAt = new Date(Date.now() - 86400000);
    expect(hasTrialExpired(makeSub({ status: 'TRIAL', trialEndsAt }))).toBe(true);
  });

  it('returns false when trial end date is in the future', () => {
    const trialEndsAt = new Date(Date.now() + 86400000);
    expect(hasTrialExpired(makeSub({ status: 'TRIAL', trialEndsAt }))).toBe(false);
  });
});

describe('canAccessFeature', () => {
  it('returns true for any feature during beta', () => {
    expect(canAccessFeature('PER_USER', 'api_access')).toBe(true);
  });
});
