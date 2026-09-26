jest.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceRetention: { findUnique: jest.fn(), delete: jest.fn(), upsert: jest.fn() },
    team: { findMany: jest.fn() },
    teamMember: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    documentUpload: { count: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))
jest.mock('@/lib/entitlements', () => ({ getWorkspaceEntitlement: jest.fn(), billingEnforced: jest.fn() }))
jest.mock('@/lib/email', () => ({ sendWorkspaceDeletionWarningEmail: jest.fn() }))

import {
  deletionDueAt,
  earliestDeletionAt,
  planRetention,
  processOwner,
  DELETION_AFTER_DAYS,
} from '@/lib/workspaceRetention'
import { prisma } from '@/lib/prisma'
import { getWorkspaceEntitlement } from '@/lib/entitlements'
import { sendWorkspaceDeletionWarningEmail } from '@/lib/email'

const DAY = 86_400_000
const now = new Date('2027-06-01T00:00:00Z')
const ago = (days: number) => new Date(now.getTime() - days * DAY)
const db = prisma as unknown as Record<string, Record<string, jest.Mock>> & { $transaction: jest.Mock }

describe('planRetention (90 days read-only, warnings at 30 and 7)', () => {
  it.each([
    ['day 10 read-only', 10, null, 'NONE'],
    ['30-day warning due', 60, null, 'WARN_30'],
    ['30-day warning already sent', 70, { warned30At: ago(10), warned7At: null }, 'NONE'],
    ['7-day warning due', 83, { warned30At: ago(23), warned7At: null }, 'WARN_7'],
    ['missed the 30-day window: goes straight to the 7-day warning', 85, null, 'WARN_7'],
    ['warned 7 days ago on day 83, now day 90', 90, { warned30At: ago(30), warned7At: ago(7) }, 'DELETE'],
    ['day 95 but no 7-day warning was ever delivered', 95, { warned30At: ago(35), warned7At: null }, 'WARN_7'],
    ['day 95, 7-day warning only 3 days ago', 95, { warned30At: ago(35), warned7At: ago(3) }, 'WAIT'],
  ] as const)('%s', (_label, daysReadOnly, markers, expected) => {
    expect(planRetention(ago(daysReadOnly), markers, now)).toBe(expected)
  })

  it('never deletes less than 7 days after the 7-day warning', () => {
    const readOnlySince = ago(120)
    expect(earliestDeletionAt(readOnlySince, ago(2))).toEqual(new Date(ago(2).getTime() + 7 * DAY))
    expect(earliestDeletionAt(readOnlySince, null)).toBeNull()
    expect(deletionDueAt(readOnlySince)).toEqual(new Date(readOnlySince.getTime() + DELETION_AFTER_DAYS * DAY))
  })
})

describe('processOwner', () => {
  const readOnly = (days: number) => ({ access: 'READ_ONLY', readOnlySince: ago(days), reason: 'TRIAL_EXPIRED' })

  beforeEach(() => {
    jest.clearAllMocks()
    db.workspaceRetention.findUnique.mockResolvedValue(null)
    db.team.findMany.mockResolvedValue([{ id: 't1', name: 'Acme Fleet' }])
    db.teamMember.findMany.mockResolvedValue([
      { user: { email: 'admin@acme.test' } },
      { user: { email: 'owner@acme.test' } },
    ])
    db.user.findUnique.mockResolvedValue({ email: 'owner@acme.test' })
    ;(sendWorkspaceDeletionWarningEmail as jest.Mock).mockResolvedValue({ success: true })
  })

  it('does nothing for a workspace with full access, and clears a stale timeline', async () => {
    ;(getWorkspaceEntitlement as jest.Mock).mockResolvedValue({ access: 'FULL', readOnlySince: null })
    expect((await processOwner('o1', now, false)).action).toBe('NONE')
    db.workspaceRetention.findUnique.mockResolvedValue({ ownerId: 'o1', readOnlySince: ago(80) })
    expect((await processOwner('o1', now, false)).action).toBe('RESET')
    expect(db.workspaceRetention.delete).toHaveBeenCalledWith({ where: { ownerId: 'o1' } })
  })

  it('dry run reports the action without emailing or writing', async () => {
    ;(getWorkspaceEntitlement as jest.Mock).mockResolvedValue(readOnly(60))
    const result = await processOwner('o1', now, true)
    expect(result).toMatchObject({ action: 'WARN_30', deletionDueAt: deletionDueAt(ago(60)).toISOString() })
    expect(sendWorkspaceDeletionWarningEmail).not.toHaveBeenCalled()
    expect(db.workspaceRetention.upsert).not.toHaveBeenCalled()
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('sends the 30-day warning to the owner and admins once, then records it', async () => {
    ;(getWorkspaceEntitlement as jest.Mock).mockResolvedValue(readOnly(60))
    expect((await processOwner('o1', now, false)).action).toBe('WARN_30')
    const recipients = (sendWorkspaceDeletionWarningEmail as jest.Mock).mock.calls.map((call) => call[0])
    expect(recipients.sort()).toEqual(['admin@acme.test', 'owner@acme.test'])
    expect((sendWorkspaceDeletionWarningEmail as jest.Mock).mock.calls[0].slice(1)).toEqual([
      'Acme Fleet',
      deletionDueAt(ago(60)),
    ])
    expect(db.workspaceRetention.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { ownerId: 'o1', readOnlySince: ago(60), warned30At: now, warned7At: null } })
    )
  })

  it('does not record a warning the owner never received, which postpones deletion', async () => {
    ;(getWorkspaceEntitlement as jest.Mock).mockResolvedValue(readOnly(84))
    ;(sendWorkspaceDeletionWarningEmail as jest.Mock).mockResolvedValue({ success: false })
    expect((await processOwner('o1', now, false)).action).toBe('EMAIL_FAILED')
    expect(db.workspaceRetention.upsert).not.toHaveBeenCalled()
  })

  it('a late 7-day warning promises at least 7 more days', async () => {
    ;(getWorkspaceEntitlement as jest.Mock).mockResolvedValue(readOnly(95))
    expect((await processOwner('o1', now, false)).action).toBe('WARN_7')
    expect((sendWorkspaceDeletionWarningEmail as jest.Mock).mock.calls[0][2]).toEqual(new Date(now.getTime() + 7 * DAY))
  })

  it('never re-warns a workspace already deleted for this lapse', async () => {
    ;(getWorkspaceEntitlement as jest.Mock).mockResolvedValue(readOnly(100))
    db.workspaceRetention.findUnique.mockResolvedValue({ readOnlySince: ago(100), deletedAt: ago(3) })
    expect((await processOwner('o1', now, false)).action).toBe('NONE')
    expect(sendWorkspaceDeletionWarningEmail).not.toHaveBeenCalled()
  })

  it('waits for stored documents to be cleaned up (files included) before deleting', async () => {
    ;(getWorkspaceEntitlement as jest.Mock).mockResolvedValue(readOnly(100))
    db.workspaceRetention.findUnique.mockResolvedValue({
      readOnlySince: ago(100),
      warned30At: ago(40),
      warned7At: ago(8),
      deletedAt: null,
    })
    db.documentUpload.count.mockResolvedValue(2)
    expect((await processOwner('o1', now, false)).action).toBe('WAIT_DOCUMENTS')
    expect(db.documentUpload.updateMany).toHaveBeenCalledWith({
      where: { OR: [{ ownerId: 'o1' }, { teamId: { in: ['t1'] } }], deletedAt: null, expiresAt: { gt: now } },
      data: { expiresAt: now },
    })
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('re-checks inside the locked transaction and skips a workspace reactivated at the last moment', async () => {
    ;(getWorkspaceEntitlement as jest.Mock)
      .mockResolvedValueOnce(readOnly(100))
      .mockResolvedValueOnce({ access: 'FULL', readOnlySince: null })
    db.workspaceRetention.findUnique.mockResolvedValue({
      readOnlySince: ago(100),
      warned30At: ago(40),
      warned7At: ago(8),
      deletedAt: null,
    })
    db.documentUpload.count.mockResolvedValue(0)
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      workspaceRetention: { findUnique: jest.fn().mockResolvedValue({ warned7At: ago(8), deletedAt: null }) },
    }
    db.$transaction.mockImplementation(async (fn: (client: unknown) => unknown) => fn(tx))
    expect((await processOwner('o1', now, false)).action).toBe('SKIPPED_REACTIVATED')
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2)
  })
})
