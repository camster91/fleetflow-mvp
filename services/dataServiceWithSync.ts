/**
 * Fleet data service — backed by REST API + PostgreSQL via Prisma.
 * Replaces the old localStorage / sync-data approach.
 * All data is organisation-wide (single-tenant); every authenticated user shares it.
 */
export * from './apiService'
