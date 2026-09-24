import { spawnSync } from 'child_process'
import path from 'path'
import { localDateOnly, parseDateOnly, startOfUtcDay, toDateOnly } from '@/lib/dateOnly'
import { dbToMaintenanceTask, maintenanceTaskToDb, type MaintenanceTask } from '@/lib/fleet'
import type { MaintenanceTask as DbMaintenanceTask } from '@prisma/client'

// Jest sandboxes process.env, so TZ cannot be switched inside a test file.
// The assertions below run in the ambient zone, and the matrix test re-runs
// this file in child Jest processes with TZ set west and east of UTC.
const ZONES = ['UTC', 'America/Toronto', 'America/Vancouver', 'Pacific/Auckland']
const isChild = process.env.DATE_ONLY_TZ_CHILD === '1'
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone

describe(`date-only helpers (TZ=${zone})`, () => {
  it('runs in the requested zone', () => {
    if (process.env.TZ) expect(zone).toBe(process.env.TZ)
  })

  it('stores date-only strings at UTC midnight and reads them back unchanged', () => {
    const parsed = parseDateOnly('2026-03-08')
    expect(parsed?.toISOString()).toBe('2026-03-08T00:00:00.000Z')
    expect(toDateOnly(parsed)).toBe('2026-03-08')
    expect(toDateOnly(parseDateOnly('2026-11-01T23:59:59.000Z'))).toBe('2026-11-01')
  })

  it('rejects invalid or empty values', () => {
    expect(parseDateOnly('2026-02-30')).toBeNull()
    expect(parseDateOnly('not-a-date')).toBeNull()
    expect(parseDateOnly('')).toBeNull()
    expect(parseDateOnly(null)).toBeNull()
    expect(toDateOnly(undefined)).toBeUndefined()
  })

  it('round-trips maintenance dueDate and completedDate through the DB converters', () => {
    const input: Omit<MaintenanceTask, 'id'> = {
      vehicle: 'Van 1',
      type: 'Oil change',
      dueDate: '2026-11-01',
      priority: 'medium',
      completed: true,
      completedDate: '2026-10-31',
    }
    const db = maintenanceTaskToDb(input, 'owner-1')
    expect(db.dueDate.toISOString()).toBe('2026-11-01T00:00:00.000Z')
    expect(db.completedDate?.toISOString()).toBe('2026-10-31T00:00:00.000Z')

    const back = dbToMaintenanceTask({ ...db, id: 't1' } as unknown as DbMaintenanceTask)
    expect(back.dueDate).toBe('2026-11-01')
    expect(back.completedDate).toBe('2026-10-31')
  })

  it('formats "today" from local calendar fields, not the UTC day', () => {
    // 23:00 local on 24 Sept: toISOString() would report 25 Sept west of UTC.
    const lateEvening = new Date(2026, 8, 24, 23, 0, 0)
    expect(localDateOnly(lateEvening)).toBe('2026-09-24')
    const earlyMorning = new Date(2026, 8, 24, 0, 30, 0)
    expect(localDateOnly(earlyMorning)).toBe('2026-09-24')
  })

  it('computes the UTC start of day independent of the local zone', () => {
    expect(startOfUtcDay(new Date('2026-09-24T23:30:00.000Z')).toISOString()).toBe('2026-09-24T00:00:00.000Z')
  })
})

describe('the toISOString bug the helpers replace', () => {
  it('would shift to tomorrow at 23:00 west of UTC', () => {
    const lateEvening = new Date(2026, 8, 24, 23, 0, 0)
    if (lateEvening.getTimezoneOffset() > 60) {
      expect(lateEvening.toISOString().split('T')[0]).toBe('2026-09-25')
    }
    expect(localDateOnly(lateEvening)).toBe('2026-09-24')
  })
})

;(isChild ? describe.skip : describe)('date-only helpers across time zones', () => {
  it.each(ZONES)('passes with TZ=%s', (tz) => {
    const root = path.resolve(__dirname, '../..')
    const result = spawnSync(
      process.execPath,
      [path.join(root, 'node_modules/jest/bin/jest.js'), '--selectProjects', 'unit', '--runTestsByPath', path.join(root, '__tests__/lib/dateOnly.test.ts')],
      { cwd: root, env: { ...process.env, TZ: tz, DATE_ONLY_TZ_CHILD: '1' }, encoding: 'utf8' },
    )
    if (result.status !== 0) throw new Error(`TZ=${tz} failed:\n${result.stderr}`)
    expect(result.stderr).toMatch(/Tests:\s+\d+ skipped, 7 passed/)
  }, 60_000)
})
