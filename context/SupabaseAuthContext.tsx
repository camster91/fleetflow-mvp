/**
 * Compatibility shim — re-exports from AuthContext.
 * Authentication is now handled by NextAuth (useSession from next-auth/react).
 */
export { useAuth, AuthProvider, rolePermissions, roleDescriptions } from './AuthContext'
export type { UserRole } from './AuthContext'
