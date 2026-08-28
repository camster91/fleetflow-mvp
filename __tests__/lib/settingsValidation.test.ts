import {
  notificationUpdateSchema,
  parseStoredPreferences,
  profileUpdateSchema,
} from '@/lib/settingsValidation'

describe('user settings validation', () => {
  it('accepts the settings payloads used by the current UI', () => {
    expect(profileUpdateSchema.safeParse({
      name: 'Fleet Manager',
      company: 'Northwind',
      phone: '+1 555 0100',
      bio: 'Dispatch lead',
      notificationSettings: {
        emailDeliveries: true,
        weeklyReports: false,
      },
      preferences: {
        language: 'en',
        timezone: 'America/Toronto',
        dateFormat: 'YYYY-MM-DD',
        theme: 'dark',
        isPublic: false,
      },
    }).success).toBe(true)
  })

  it.each([
    {},
    { image: 'data:image/png;base64,abc' },
    { name: '' },
    { name: 'x'.repeat(101) },
    { company: 'x'.repeat(121) },
    { phone: 'x'.repeat(41) },
    { bio: 'x'.repeat(1001) },
    { preferences: { language: 'xx' } },
    { preferences: { timezone: 'Etc/Unknown' } },
    { notificationSettings: { arbitrary: true } },
  ])('rejects empty, unsupported, or unbounded profile payload %p', (payload) => {
    expect(profileUpdateSchema.safeParse(payload).success).toBe(false)
  })

  it('requires a strict notification update envelope', () => {
    expect(notificationUpdateSchema.safeParse({
      notificationSettings: { emailMaintenance: true },
    }).success).toBe(true)
    expect(notificationUpdateSchema.safeParse({
      notificationSettings: {},
    }).success).toBe(false)
    expect(notificationUpdateSchema.safeParse({
      notificationSettings: { emailMaintenance: true },
      extra: true,
    }).success).toBe(false)
  })

  it('recovers from malformed legacy preference JSON and strips unknown keys', () => {
    expect(parseStoredPreferences('{broken')).toEqual({})
    expect(parseStoredPreferences('null')).toEqual({})
    expect(parseStoredPreferences(JSON.stringify({
      phone: '+1 555 0100',
      unknownSecret: 'drop-me',
      preferences: {
        language: 'en',
        arbitrary: 'drop-me',
      },
    }))).toEqual({
      phone: '+1 555 0100',
      preferences: { language: 'en' },
    })
  })
})
