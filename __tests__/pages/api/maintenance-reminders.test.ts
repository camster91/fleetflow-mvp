import { createMocks } from 'node-mocks-http'

type Row = {
  id: string
  ownerId: string
  title: string
  vehicleName: string | null
  dueDate: Date
  completed: boolean
  reminderSentAt: Date | null
  overdueReminderSentAt: Date | null
  teamId: string | null
  team: { timeZone: string } | null
  owner: { id: string; email: string | null; name: string; timeZone: string }
  vehicle: { name: string } | null
}

const mockDueDateRef = { __fieldRef: 'dueDate' }
const mockRows: Row[] = []

type Where = Record<string, unknown>
const compare = (value: Date | null, filter: unknown, row: Row): boolean => {
  if (filter === null) return value === null
  if (filter instanceof Date) return value?.getTime() === filter.getTime()
  const f = filter as { gte?: unknown; lt?: unknown; lte?: unknown }
  const resolve = (v: unknown) => (v === mockDueDateRef ? row.dueDate : (v as Date))
  if (value === null) return false
  if (f.gte && !(value >= resolve(f.gte))) return false
  if (f.lte && !(value <= resolve(f.lte))) return false
  if (f.lt && !(value < resolve(f.lt))) return false
  return true
}
const zoneMatches = (zone: string | undefined, filter: unknown): boolean => {
  const f = (filter as { timeZone: { in?: string[]; notIn?: string[] } }).timeZone
  if (zone === undefined) return false
  if (f.in) return f.in.includes(zone)
  if (f.notIn) return !f.notIn.includes(zone)
  throw new Error('unsupported timeZone filter')
}
const mockMatches = (row: Row, where: Where): boolean =>
  Object.entries(where).every(([key, filter]) => {
    if (key === 'OR') return (filter as Where[]).some((w) => mockMatches(row, w))
    if (key === 'AND') return (filter as Where[]).every((w) => mockMatches(row, w))
    if (key === 'teamId') return row.teamId === filter
    if (key === 'team') return zoneMatches(row.team?.timeZone, filter)
    if (key === 'owner') return zoneMatches(row.owner.timeZone, filter)
    if (key === 'id') return row.id === filter
    if (key === 'completed') return row.completed === filter
    if (key === 'dueDate') return compare(row.dueDate, filter, row)
    if (key === 'reminderSentAt') return compare(row.reminderSentAt, filter, row)
    if (key === 'overdueReminderSentAt') return compare(row.overdueReminderSentAt, filter, row)
    throw new Error(`unsupported where key ${key}`)
  })

const mockState = { active: 0, max: 0 }
const notificationCreate = jest.fn()
const mockTx = {
  maintenanceTask: {
    updateMany: jest.fn(async ({ where, data }: { where: Where; data: Partial<Pick<Row, 'reminderSentAt' | 'overdueReminderSentAt'>> }) => {
      const hit = mockRows.filter((row) => mockMatches(row, where))
      hit.forEach((row) => { Object.assign(row, data) })
      return { count: hit.length }
    }),
  },
  notification: { create: notificationCreate },
}

const mockDistinctZones = (pick: (row: Row) => string | undefined) =>
  [...new Set(mockRows.map(pick).filter((zone): zone is string => !!zone))].map((timeZone) => ({ timeZone }))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    team: { findMany: jest.fn(async () => mockDistinctZones((row) => row.team?.timeZone)) },
    user: { findMany: jest.fn(async () => mockDistinctZones((row) => row.owner.timeZone)) },
    maintenanceTask: {
      get fields() { return { dueDate: mockDueDateRef } },
      findMany: jest.fn(async ({ where, take }: { where: Where; take: number }) =>
        mockRows.filter((row) => mockMatches(row, where))
          .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
          .slice(0, take)
          .map((row) => ({ ...row }))),
    },
    $transaction: jest.fn(async (callback: (client: typeof mockTx) => unknown) => {
      mockState.active += 1
      mockState.max = Math.max(mockState.max, mockState.active)
      try {
        await new Promise((resolve) => setImmediate(resolve))
        return await callback(mockTx)
      } finally {
        mockState.active -= 1
      }
    }),
  },
}))
jest.mock('@/lib/email.server', () => ({
  notifyMaintenanceDue: jest.fn(() => Promise.resolve()),
}))

import handler from '@/pages/api/cron/maintenance-reminders'
import { notifyMaintenanceDue } from '@/lib/email.server'

const secret = 's'.repeat(32)
// Cron runs at 08:30 UTC on 2026-09-24; due dates are stored at UTC midnight.
const NOW = new Date('2026-09-24T08:30:00.000Z')
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

const makeRow = (id: string, dueDate: Date, extra: Partial<Row> = {}): Row => ({
  id,
  ownerId: 'owner-1',
  title: `Task ${id}`,
  vehicleName: 'Van 1',
  dueDate,
  completed: false,
  reminderSentAt: null,
  overdueReminderSentAt: null,
  teamId: null,
  team: null,
  owner: { id: 'owner-1', email: 'owner@example.com', name: 'Owner', timeZone: 'America/Toronto' },
  vehicle: { name: 'Van 1' },
  ...extra,
})

async function runCron() {
  const { req, res } = createMocks({ method: 'POST', headers: { 'x-cron-secret': secret } })
  await handler(req as never, res as never)
  return { status: res._getStatusCode(), body: JSON.parse(res._getData()) }
}

const notifiedTaskIds = () =>
  notificationCreate.mock.calls.map(([arg]) => JSON.parse(arg.data.data).taskId).sort()

describe('POST /api/cron/maintenance-reminders', () => {
  let infoSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] })
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {})
    mockRows.length = 0
    mockState.active = 0
    mockState.max = 0
    process.env.CRON_SECRET = secret
    notificationCreate.mockResolvedValue({ id: 'notification-1' })
  })

  afterEach(() => {
    jest.useRealTimers()
    infoSpy.mockRestore()
  })

  afterAll(() => {
    delete process.env.CRON_SECRET
  })

  it('reminds a task due today even though its midnight due time has passed', async () => {
    mockRows.push(makeRow('today', day('2026-09-24')))
    const { body } = await runCron()
    expect(body).toMatchObject({ remindersSent: 1, dueSoonSent: 1, overdueSent: 0 })
    expect(notifiedTaskIds()).toEqual(['today'])
    expect(notificationCreate.mock.calls[0][0].data.message).toContain('is due on 2026-09-24')
  })

  it('reminds a task due tomorrow and one on the last day of the window, not beyond', async () => {
    mockRows.push(makeRow('tomorrow', day('2026-09-25')), makeRow('day7', day('2026-10-01')), makeRow('day8', day('2026-10-02')))
    const { body } = await runCron()
    expect(body.dueSoonSent).toBe(2)
    expect(notifiedTaskIds()).toEqual(['day7', 'tomorrow'])
  })

  it('sends a separate overdue reminder, including for tasks already reminded before they were due', async () => {
    mockRows.push(
      makeRow('overdue-never', day('2026-09-20')),
      makeRow('overdue-after-soon', day('2026-09-22'), { reminderSentAt: new Date('2026-09-18T08:30:00.000Z') }),
    )
    const { body } = await runCron()
    expect(body).toMatchObject({ remindersSent: 2, overdueSent: 2, dueSoonSent: 0 })
    expect(notificationCreate.mock.calls.every(([arg]) => arg.data.title === 'Maintenance Overdue')).toBe(true)
    expect(notifyMaintenanceDue).toHaveBeenCalledWith(
      { name: 'Van 1' },
      ['Task overdue-never (overdue since 2026-09-20)'],
      ['owner@example.com'],
    )
  })

  it('does not remind again when already reminded (due soon or overdue) and dedupes a same-day rerun', async () => {
    mockRows.push(
      makeRow('soon-reminded', day('2026-09-26'), { reminderSentAt: new Date('2026-09-23T08:30:00.000Z') }),
      makeRow('overdue-reminded', day('2026-09-20'), { reminderSentAt: new Date('2026-09-15T08:30:00.000Z'), overdueReminderSentAt: new Date('2026-09-21T08:30:00.000Z') }),
      makeRow('completed', day('2026-09-20'), { completed: true }),
      makeRow('fresh', day('2026-09-25')),
    )
    const first = await runCron()
    expect(first.body.remindersSent).toBe(1)
    expect(notifiedTaskIds()).toEqual(['fresh'])

    notificationCreate.mockClear()
    const second = await runCron()
    expect(second.body.remindersSent).toBe(0)
    expect(notificationCreate).not.toHaveBeenCalled()
  })

  it('still sends the overdue reminder for a task reminded on its due day, exactly once', async () => {
    // Reminded (due soon) at 08:30 on its due day, so reminderSentAt > dueDate.
    mockRows.push(makeRow('due-day-reminded', day('2026-09-23'), { reminderSentAt: new Date('2026-09-23T08:30:00.000Z') }))
    const first = await runCron()
    expect(first.body).toMatchObject({ remindersSent: 1, overdueSent: 1, dueSoonSent: 0 })
    expect(notifiedTaskIds()).toEqual(['due-day-reminded'])
    expect(mockRows[0].overdueReminderSentAt).toEqual(NOW)
    expect(mockRows[0].reminderSentAt).toEqual(new Date('2026-09-23T08:30:00.000Z'))

    notificationCreate.mockClear()
    jest.setSystemTime(new Date('2026-09-25T08:30:00.000Z'))
    const second = await runCron()
    expect(second.body.remindersSent).toBe(0)
    expect(notificationCreate).not.toHaveBeenCalled()
  })

  it('does not notify when another invocation already claimed the candidate', async () => {
    mockRows.push(makeRow('raced', day('2026-09-25')))
    mockTx.maintenanceTask.updateMany.mockResolvedValueOnce({ count: 0 })
    const { body } = await runCron()
    expect(notificationCreate).not.toHaveBeenCalled()
    expect(notifyMaintenanceDue).not.toHaveBeenCalled()
    expect(body).toMatchObject({ remindersSent: 0, skipped: 1 })
  })

  it('claims in batches of at most 10 concurrent transactions and counts failures without aborting', async () => {
    for (let i = 0; i < 150; i += 1) mockRows.push(makeRow(`t${String(i).padStart(3, '0')}`, day('2026-09-25')))
    notificationCreate.mockImplementation(async ({ data }) => {
      if (JSON.parse(data.data).taskId === 't007') throw new Error('P2024 simulated')
      return { id: 'n' }
    })
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { status, body } = await runCron()
    errorSpy.mockRestore()
    expect(status).toBe(200)
    expect(mockState.max).toBeLessThanOrEqual(10)
    expect(mockState.max).toBeGreaterThan(1)
    expect(body).toMatchObject({ remindersSent: 149, failed: 1 })
  })

  describe('per-workspace time zone', () => {
    const inTeam = (zone: string) => ({ teamId: `team-${zone}`, team: { timeZone: zone } })

    it('treats a Vancouver task due today as due today at 23:30 local (07:30 UTC the next day)', async () => {
      // 2026-12-01 23:30 PST is 2026-12-02 07:30 UTC.
      jest.setSystemTime(new Date('2026-12-02T07:30:00.000Z'))
      mockRows.push(
        makeRow('vancouver-today', day('2026-12-01'), inTeam('America/Vancouver')),
        makeRow('utc-yesterday', day('2026-12-01'), inTeam('UTC')),
      )
      const { body } = await runCron()
      expect(body).toMatchObject({ remindersSent: 2, dueSoonSent: 1, overdueSent: 1 })
      const byTask = Object.fromEntries(notificationCreate.mock.calls.map(([arg]) => [JSON.parse(arg.data.data).taskId, arg.data.title]))
      expect(byTask).toEqual({ 'vancouver-today': 'Maintenance Reminder', 'utc-yesterday': 'Maintenance Overdue' })
    })

    it('uses the owner zone for personal tasks and Toronto for the default', async () => {
      // 2026-09-25 02:00 UTC is still 2026-09-24 22:00 in Toronto.
      jest.setSystemTime(new Date('2026-09-25T02:00:00.000Z'))
      mockRows.push(
        makeRow('toronto-personal', day('2026-09-24')),
        makeRow('utc-personal', day('2026-09-24'), { owner: { id: 'owner-2', email: 'utc@example.com', name: 'UTC', timeZone: 'UTC' } }),
      )
      const { body } = await runCron()
      expect(body).toMatchObject({ dueSoonSent: 1, overdueSent: 1 })
      const overdueTask = notificationCreate.mock.calls.find(([arg]) => arg.data.title === 'Maintenance Overdue')![0]
      expect(JSON.parse(overdueTask.data.data).taskId).toBe('utc-personal')
    })

    it('treats an invalid stored zone as the default zone', async () => {
      jest.setSystemTime(new Date('2026-09-25T02:00:00.000Z'))
      mockRows.push(makeRow('bad-zone', day('2026-09-24'), inTeam('Mars/Olympus')))
      const { body } = await runCron()
      expect(body).toMatchObject({ remindersSent: 1, dueSoonSent: 1, overdueSent: 0 })
    })
  })
})
