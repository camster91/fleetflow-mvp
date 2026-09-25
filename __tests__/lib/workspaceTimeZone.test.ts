import {
  canonicalTimeZone,
  DEFAULT_TIME_ZONE,
  isValidTimeZone,
  normalizeTimeZone,
  startOfTodayInZone,
  supportedTimeZones,
  todayDateOnly,
} from '@/lib/dateOnly'
import { getWorkspaceTimeZone } from '@/lib/workspaceTimeZone'
import { maintenanceScheduleFindings } from '@/lib/intelligence/rules'
import { scoreMaintenanceRisk } from '@/lib/intelligence/maintenanceRisk'

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

describe('workspace time zone helpers', () => {
  it('reports today in the workspace zone, not the UTC day', () => {
    // 23:30 PST on 2026-12-01 is 07:30 UTC on 2026-12-02.
    const now = new Date('2026-12-02T07:30:00.000Z')
    expect(todayDateOnly('America/Vancouver', now)).toBe('2026-12-01')
    expect(todayDateOnly('UTC', now)).toBe('2026-12-02')
    expect(startOfTodayInZone('America/Vancouver', now)).toEqual(day('2026-12-01'))
  })

  it.each([
    // [instant, Toronto day, UTC day]
    ['2026-09-25T03:59:59.999Z', '2026-09-24', '2026-09-25'], // 23:59:59 EDT
    ['2026-09-25T04:00:00.000Z', '2026-09-25', '2026-09-25'], // midnight EDT
    ['2026-01-15T04:59:59.999Z', '2026-01-14', '2026-01-15'], // 23:59:59 EST
    ['2026-01-15T05:00:00.000Z', '2026-01-15', '2026-01-15'], // midnight EST
    ['2026-03-08T06:59:00.000Z', '2026-03-08', '2026-03-08'], // after spring-forward
    ['2026-11-01T04:30:00.000Z', '2026-11-01', '2026-11-01'], // 00:30 EDT on fall-back day
  ])('Toronto vs UTC boundary at %s', (instant, toronto, utc) => {
    const now = new Date(instant)
    expect(todayDateOnly('America/Toronto', now)).toBe(toronto)
    expect(todayDateOnly('UTC', now)).toBe(utc)
  })

  it('validates IANA names and rejects offsets and unknown zones', () => {
    expect(isValidTimeZone('America/Toronto')).toBe(true)
    expect(isValidTimeZone('America/Argentina/Buenos_Aires')).toBe(true)
    expect(isValidTimeZone('UTC')).toBe(true)
    for (const bad of ['Mars/Olympus', '+05:00', '', ' America/Toronto', 'America/Toronto; DROP', null, 5]) {
      expect(isValidTimeZone(bad)).toBe(false)
    }
    expect(canonicalTimeZone('america/toronto')).toBe('America/Toronto')
    expect(canonicalTimeZone('Mars/Olympus')).toBeNull()
  })

  it('falls back to the default zone for invalid stored values', () => {
    expect(normalizeTimeZone('Mars/Olympus')).toBe(DEFAULT_TIME_ZONE)
    expect(todayDateOnly('Mars/Olympus', new Date('2026-09-25T02:00:00.000Z'))).toBe('2026-09-24')
    expect(supportedTimeZones()).toEqual(expect.arrayContaining(['America/Toronto', 'America/Vancouver', 'UTC']))
  })

  it('reads the team zone for team scope and the owner zone for personal scope', async () => {
    const db = {
      team: { findUnique: jest.fn().mockResolvedValue({ timeZone: 'America/Vancouver' }) },
      user: { findUnique: jest.fn().mockResolvedValue({ timeZone: 'America/Halifax' }) },
    }
    await expect(getWorkspaceTimeZone({ ownerId: 'o1', teamId: 't1' }, db)).resolves.toBe('America/Vancouver')
    expect(db.team.findUnique).toHaveBeenCalledWith({ where: { id: 't1' }, select: { timeZone: true } })
    await expect(getWorkspaceTimeZone({ ownerId: 'o1', teamId: null }, db)).resolves.toBe('America/Halifax')
    expect(db.user.findUnique).toHaveBeenCalledWith({ where: { id: 'o1' }, select: { timeZone: true } })
  })

  it('falls back to the default zone when the lookup fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const db = {
      team: { findUnique: jest.fn().mockRejectedValue(new Error('down')) },
      user: { findUnique: jest.fn() },
    }
    await expect(getWorkspaceTimeZone({ ownerId: 'o1', teamId: 't1' }, db)).resolves.toBe(DEFAULT_TIME_ZONE)
    errorSpy.mockRestore()
  })
})

describe('overdue checks use the workspace calendar day', () => {
  // 23:30 PST on 2026-12-01.
  const now = new Date('2026-12-02T07:30:00.000Z')
  const tasks = [
    { id: 'due-today', completed: false, dueDate: day('2026-12-01') },
    { id: 'due-yesterday', completed: false, dueDate: day('2026-11-30') },
  ]

  it('intelligence findings: due today in Vancouver is due soon, not overdue', () => {
    const findings = maintenanceScheduleFindings({
      tenantKey: 'team-1',
      now,
      timeZone: 'America/Vancouver',
      records: { maintenance: tasks },
    })
    const types = Object.fromEntries(findings.map((f) => [f.evidence[0].entityId, f.type]))
    expect(types).toEqual({ 'due-today': 'maintenance-due-soon', 'due-yesterday': 'maintenance-overdue' })
    expect(findings.find((f) => f.type === 'maintenance-overdue')?.explanation).toContain('1 day(s) ago')

    const utc = maintenanceScheduleFindings({
      tenantKey: 'team-1',
      now,
      timeZone: 'UTC',
      records: { maintenance: tasks },
    })
    expect(utc.every((f) => f.type === 'maintenance-overdue')).toBe(true)
  })

  it('maintenance risk: due today in Vancouver scores no overdue points', () => {
    const base = {
      vehicle: { id: 'v1', name: 'Van', year: 2024, mileage: 0, lastService: null, maintenanceDue: false },
      serviceMileage: null,
      costUnit: 'major' as const,
    }
    const today = scoreMaintenanceRisk(
      { ...base, tasks: [{ id: 't1', type: 'Oil', dueDate: day('2026-12-01'), completed: false }] },
      { now, timeZone: 'America/Vancouver' }
    )
    expect(today.factors.find((f) => f.code === 'overdue-maintenance')).toBeUndefined()
    const yesterday = scoreMaintenanceRisk(
      { ...base, tasks: [{ id: 't1', type: 'Oil', dueDate: day('2026-11-30'), completed: false }] },
      { now, timeZone: 'America/Vancouver' }
    )
    expect(yesterday.factors.find((f) => f.code === 'overdue-maintenance')?.points).toBe(10)
  })
})
