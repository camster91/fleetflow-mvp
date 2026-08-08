const DAY = 24 * 60 * 60 * 1000

export function integrationRetentionCutoffs(now = new Date()) {
  const before = (days: number) => new Date(now.getTime() - days * DAY)
  return { rateLimits: before(2), oauthStates: before(1), syncJobs: before(90), stagedRecords: before(365) }
}
