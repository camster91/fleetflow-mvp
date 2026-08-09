export type DashboardRole = 'admin' | 'dispatcher' | 'maintenance' | 'driver' | 'viewer'

export function resolveDashboardRole(value: unknown): DashboardRole {
  const role = typeof value === 'string' ? value.trim().toUpperCase() : ''
  if (['OWNER', 'ADMIN', 'MANAGER'].includes(role)) return 'admin'
  if (['DISPATCHER', 'DISPATCH'].includes(role)) return 'dispatcher'
  if (['TECHNICIAN', 'MAINTENANCE'].includes(role)) return 'maintenance'
  if (role === 'DRIVER') return 'driver'
  return 'viewer'
}
