export class SyncLeaseLostError extends Error { constructor() { super('Sync lease was lost'); this.name = 'SyncLeaseLostError' } }
export function isReclaimableJob(job: { status: string; lockExpiresAt: Date | null }, now = new Date()) { return job.status === 'RUNNING' && (!job.lockExpiresAt || job.lockExpiresAt <= now) }
