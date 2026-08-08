import { isReclaimableJob } from '@/lib/integrations/lease'

describe('sync generation and lease fencing', () => {
  it('reclaims running jobs only after their owning lease expires', () => {
    const now = new Date('2026-08-08T12:00:00Z')
    expect(isReclaimableJob({ status: 'RUNNING', lockExpiresAt: new Date('2026-08-08T11:59:59Z') }, now)).toBe(true)
    expect(isReclaimableJob({ status: 'RUNNING', lockExpiresAt: new Date('2026-08-08T12:00:01Z') }, now)).toBe(false)
    expect(isReclaimableJob({ status: 'COMPLETED', lockExpiresAt: new Date(0) }, now)).toBe(false)
  })
})
