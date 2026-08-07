import {
  canManageClients,
  canManageSOP,
  canManageVendingMachines,
  canManageAnnouncements,
  canViewBusinessData,
} from '@/lib/permissions'

describe('business resource role matrix', () => {
  it.each(['OWNER', 'ADMIN', 'MANAGER'] as const)('%s can manage operational records', (role) => {
    expect(canManageClients(role)).toBe(true)
    expect(canManageSOP(role)).toBe(true)
    expect(canManageVendingMachines(role)).toBe(true)
    expect(canManageAnnouncements(role)).toBe(true)
  })

  it.each(['MEMBER', 'VIEWER'] as const)('%s cannot manage administrative records', (role) => {
    expect(canManageClients(role)).toBe(false)
    expect(canManageSOP(role)).toBe(false)
    expect(canManageVendingMachines(role)).toBe(false)
    expect(canManageAnnouncements(role)).toBe(false)
  })

  it.each(['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'] as const)('%s can read business records', (role) => {
    expect(canViewBusinessData(role)).toBe(true)
  })
})
