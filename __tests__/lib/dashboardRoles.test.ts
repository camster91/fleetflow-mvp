import { resolveDashboardRole } from '../../lib/dashboardRoles'
import { TeamRole } from '../../types'

describe('resolveDashboardRole', () => {
  test.each([
    ['OWNER', 'admin'],
    ['ADMIN', 'admin'],
    ['MANAGER', 'admin'],
    ['DISPATCHER', 'dispatcher'],
    ['DISPATCH', 'dispatcher'],
    ['TECHNICIAN', 'maintenance'],
    ['MAINTENANCE', 'maintenance'],
    ['DRIVER', 'driver'],
    ['VIEWER', 'viewer'],
  ])('maps %s to %s', (role, expected) => {
    expect(resolveDashboardRole(role)).toBe(expected)
  })

  test.each(['', 'MEMBER', 'USER', 'root', undefined, null])('safely maps %s to viewer', (role) => {
    expect(resolveDashboardRole(role)).toBe('viewer')
  })

  test('exports every assignable operational role', () => {
    expect(TeamRole).toEqual(
      expect.objectContaining({ DISPATCHER: 'DISPATCHER', TECHNICIAN: 'TECHNICIAN', DRIVER: 'DRIVER' })
    )
  })
})
