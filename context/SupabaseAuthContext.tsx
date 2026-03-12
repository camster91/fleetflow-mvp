/**
 * Compatibility shim — re-exports from AuthContext with a userRole field
 * so pages that imported from SupabaseAuthContext still work.
 */
import { useAuth as _useAuth, AuthProvider, UserRole, rolePermissions, roleDescriptions } from './AuthContext'

export { AuthProvider, rolePermissions, roleDescriptions }
export type { UserRole }

export function useAuth() {
  const ctx = _useAuth()
  return {
    ...ctx,
    userRole: ctx.user?.role ?? null,
  }
}
