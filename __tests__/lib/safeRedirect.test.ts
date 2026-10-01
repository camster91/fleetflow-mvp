import { safeCallbackPath } from '@/lib/safeRedirect'

describe('safeCallbackPath', () => {
  it.each([
    ['/dashboard', '/dashboard'],
    ['/team?tab=invite#members', '/team?tab=invite#members'],
    ['/admin/launch', '/admin/launch'],
  ])('keeps the same-site path %s', (raw, expected) => {
    expect(safeCallbackPath(raw)).toBe(expected)
  })

  it.each([
    'javascript:alert(document.cookie)',
    'JaVaScRiPt:fetch("/api/keys")',
    'https://evil.example/phish',
    '//evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    'data:text/html,hi',
    '',
    undefined,
    ['/dashboard', '/x'],
  ])('falls back to the dashboard for %p', (raw) => {
    expect(safeCallbackPath(raw)).toBe('/dashboard')
  })
})
