import { createProviderRegistry, validateGoogleMapsConfig, validateQuickBooksConfig } from '@/lib/integrations/types'

describe('integration provider registry', () => {
  it('has truthful built-in capabilities and rejects duplicate providers', () => {
    const registry = createProviderRegistry()
    expect(registry.get('google-maps')?.authMode).toBe('api_key')
    expect(registry.get('quickbooks')?.authMode).toBe('oauth2')
    expect(registry.get('google-maps')?.capabilities).toEqual(['geocode'])
    expect(registry.get('quickbooks')?.capabilities).toEqual(['operating_costs'])
    expect(() => registry.register(registry.get('quickbooks')!)).toThrow('already registered')
  })

  it('allows only official QuickBooks production/sandbox API hosts and an HTTPS callback', () => {
    expect(validateQuickBooksConfig({ clientId: 'id', clientSecret: 'secret', redirectUri: 'https://fleetvera.test/callback', apiBaseUrl: 'https://quickbooks.api.intuit.com' }).success).toBe(true)
    expect(validateQuickBooksConfig({ clientId: 'id', clientSecret: 'secret', redirectUri: 'http://fleetvera.test/callback', apiBaseUrl: 'https://quickbooks.api.intuit.com' }).success).toBe(false)
    expect(validateQuickBooksConfig({ clientId: 'id', clientSecret: 'secret', redirectUri: 'https://fleetvera.test/callback', apiBaseUrl: 'https://evil.example' }).success).toBe(false)
    expect(validateQuickBooksConfig({ clientId: 'id', clientSecret: 'secret', redirectUri: 'https://fleetvera.test/callback', apiBaseUrl: 'https://sandbox-quickbooks.api.intuit.com' }).success).toBe(true)
  })

  it('requires an HTTPS Maps endpoint on the Google host and server-only key', () => {
    expect(validateGoogleMapsConfig({ apiKey: 'key', baseUrl: 'https://maps.googleapis.com' }).success).toBe(true)
    expect(validateGoogleMapsConfig({ apiKey: 'key', baseUrl: 'http://maps.googleapis.com' }).success).toBe(false)
    expect(validateGoogleMapsConfig({ apiKey: 'key', baseUrl: 'https://evil.example' }).success).toBe(false)
    expect(validateGoogleMapsConfig({ apiKey: '', baseUrl: 'https://maps.googleapis.com' }).success).toBe(false)
  })
})
