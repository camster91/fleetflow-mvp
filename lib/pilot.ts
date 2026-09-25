import { z } from 'zod'

export const PILOT_RETENTION_DAYS = 365
export const pilotEventSchema = z
  .object({
    eventType: z.enum(['DASHBOARD_OPENED', 'FIRST_USEFUL_ACTION']),
    sessionKey: z.string().regex(/^[A-Za-z0-9_-]{16,96}$/),
  })
  .strict()

export const enrollmentSchema = z
  .object({
    status: z.enum(['INVITED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'WITHDRAWN']),
    pilotStartsAt: z.string().datetime().optional(),
    pilotEndsAt: z.string().datetime().optional(),
    consent: z.boolean(),
    supportOwnerLabel: z.string().trim().min(2).max(80).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === 'ACTIVE' && !value.consent)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['consent'],
        message: 'Pilot activation requires recorded consent',
      })
    if (value.pilotStartsAt && value.pilotEndsAt && new Date(value.pilotEndsAt) <= new Date(value.pilotStartsAt))
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pilotEndsAt'], message: 'Pilot end must follow start' })
  })

export const incidentSchema = z
  .object({
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    category: z.enum(['USABILITY', 'DATA_QUALITY', 'SECURITY', 'AVAILABILITY', 'OTHER']),
  })
  .strict()

export function pilotScopeKey(ownerId: string, teamId: string | null) {
  return teamId ? `team:${teamId}` : `owner:${ownerId}`
}

export function pilotExpiry(now = new Date()) {
  return new Date(now.getTime() + PILOT_RETENTION_DAYS * 86_400_000)
}
