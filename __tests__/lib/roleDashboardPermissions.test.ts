import { canAssignDrivers, canManageDeliveries, canManageMaintenance, canManageVehicles, canViewDeliveries, canViewMaintenance } from '../../lib/permissions'
import { teamInviteSchema } from '../../lib/validation'

describe('role dashboard permissions', () => {
  it('limits dispatcher writes to deliveries', () => {
    expect(canManageDeliveries('DISPATCHER')).toBe(true)
    expect(canManageMaintenance('DISPATCHER')).toBe(false)
    expect(canManageVehicles('DISPATCHER')).toBe(false)
  })
  it('limits technician writes to maintenance', () => {
    expect(canManageMaintenance('TECHNICIAN')).toBe(true)
    expect(canManageDeliveries('TECHNICIAN')).toBe(false)
    expect(canManageVehicles('TECHNICIAN')).toBe(false)
  })
  it('keeps drivers read-only', () => {
    expect(canViewDeliveries('DRIVER')).toBe(true)
    expect(canViewMaintenance('DRIVER')).toBe(true)
    expect(canManageDeliveries('DRIVER')).toBe(false)
    expect(canManageMaintenance('DRIVER')).toBe(false)
    expect(canManageVehicles('DRIVER')).toBe(false)
  })
  it.each(['DISPATCHER', 'TECHNICIAN', 'DRIVER'])('accepts %s as an invitation role', role => {
    expect(teamInviteSchema.safeParse({ teamId: 'team-1', emails: ['person@example.test'], role }).success).toBe(true)
  })
  it.each(['OWNER','ADMIN','MANAGER','DISPATCHER','DISPATCH'] as const)('allows %s to assign drivers',role=>expect(canAssignDrivers(role)).toBe(true))
  it.each(['TECHNICIAN','MAINTENANCE','DRIVER','VIEWER','MEMBER'] as const)('denies %s from assigning drivers',role=>expect(canAssignDrivers(role)).toBe(false))
})
