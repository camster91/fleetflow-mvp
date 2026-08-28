import { readFileSync } from 'fs'
import { join } from 'path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('settings API integrity controls', () => {
  const profile = read('pages/api/settings/profile.ts')
  const notifications = read('pages/api/settings/notifications.ts')

  it.each([
    ['profile', profile],
    ['notifications', notifications],
  ])('protects and serializes %s writes', (_name, source) => {
    expect(source).toContain("req.method === 'PUT' && !assertSameOrigin(req, res)")
    expect(source).toContain("rateLimitMiddleware(req, res, 'api', `settings:${userId}`)")
    expect(source).toContain('pg_advisory_xact_lock')
    expect(source).toContain('parseStoredPreferences')
    expect(source).toContain("res.setHeader('Cache-Control', 'private, no-store')")
  })

  it('does not return the raw serialized preference column', () => {
    expect(profile).toContain(
      'const { notificationPreferences: _privatePreferences, ...safeUser } = user',
    )
    expect(profile).toContain('return { user: { ...safeUser, prefs }, prefs }')
  })

  it('keeps unsupported avatar writes visibly disabled', () => {
    const page = read('pages/settings/profile.tsx')

    expect(page).not.toContain("body: JSON.stringify({ image: dataUrl })")
    expect(page).toContain('Profile photo uploads are not yet available.')
    expect(page).toContain('Upload coming soon')
  })
})
