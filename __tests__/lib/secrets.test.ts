import { constantTimeCompare, hashToken } from '@/lib/tokens'
import { verifyStoredApiKey } from '@/pages/api/settings/api-keys'

describe('secret comparisons', () => {
  it('accepts only identical values, including different-length inputs', () => {
    expect(constantTimeCompare('same-secret', 'same-secret')).toBe(true)
    expect(constantTimeCompare('same-secret', 'other-secret')).toBe(false)
    expect(constantTimeCompare('short', 'a-much-longer-secret')).toBe(false)
  })

  it('verifies API keys through the constant-time helper', () => {
    const key = 'ff_example-secret'
    expect(verifyStoredApiKey(key, hashToken(key))).toBe(true)
    expect(verifyStoredApiKey('ff_wrong', hashToken(key))).toBe(false)
  })
})
