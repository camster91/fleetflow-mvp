import { z } from 'zod'

export const notificationSettingsSchema = z.object({
  emailDeliveries: z.boolean().optional(),
  emailMaintenance: z.boolean().optional(),
  pushDeliveries: z.boolean().optional(),
  pushMaintenance: z.boolean().optional(),
  weeklyReports: z.boolean().optional(),
}).strict().refine(value => Object.keys(value).length > 0, {
  message: 'At least one notification setting is required',
})

export const appPreferencesSchema = z.object({
  language: z.enum(['en', 'fr', 'es', 'de']).optional(),
  timezone: z.enum([
    'America/Toronto',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Vancouver',
    'Europe/London',
    'Europe/Paris',
  ]).optional(),
  dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).optional(),
  theme: z.enum(['light', 'dark']).optional(),
  isPublic: z.boolean().optional(),
}).strict().refine(value => Object.keys(value).length > 0, {
  message: 'At least one preference is required',
})

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  company: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  bio: z.string().trim().max(1000).optional(),
  notificationSettings: notificationSettingsSchema.optional(),
  preferences: appPreferencesSchema.optional(),
}).strict().refine(value => Object.keys(value).length > 0, {
  message: 'At least one profile field is required',
})

const storedPreferencesSchema = z.object({
  phone: z.string().max(40).optional(),
  bio: z.string().max(1000).optional(),
  notificationSettings: z.object({
    emailDeliveries: z.boolean().optional(),
    emailMaintenance: z.boolean().optional(),
    pushDeliveries: z.boolean().optional(),
    pushMaintenance: z.boolean().optional(),
    weeklyReports: z.boolean().optional(),
  }).optional(),
  preferences: z.object({
    language: z.enum(['en', 'fr', 'es', 'de']).optional(),
    timezone: z.string().max(64).optional(),
    dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).optional(),
    theme: z.enum(['light', 'dark']).optional(),
    isPublic: z.boolean().optional(),
  }).optional(),
})

export type StoredPreferences = z.infer<typeof storedPreferencesSchema>

export function parseStoredPreferences(raw: string | null): StoredPreferences {
  if (!raw) return {}
  try {
    const parsed = storedPreferencesSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}
