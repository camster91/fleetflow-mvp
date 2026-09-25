import { z } from 'zod'

export type IntegrationProviderId = 'google-maps' | 'quickbooks'
export type IntegrationCapability = 'geocode' | 'routes' | 'expenses' | 'operating_costs'

export interface IntegrationProviderDefinition {
  id: IntegrationProviderId | (string & {})
  name: string
  authMode: 'api_key' | 'oauth2'
  capabilities: IntegrationCapability[]
  readiness: () => { ready: boolean; reason?: string }
}

export class IntegrationProviderRegistry {
  private readonly providers = new Map<string, IntegrationProviderDefinition>()
  register(provider: IntegrationProviderDefinition) {
    if (!/^[a-z][a-z0-9-]{1,49}$/.test(provider.id)) throw new Error('Invalid provider id')
    if (this.providers.has(provider.id)) throw new Error(`Provider ${provider.id} is already registered`)
    this.providers.set(provider.id, Object.freeze({ ...provider, capabilities: [...provider.capabilities] }))
    return this
  }
  get(id: string) {
    return this.providers.get(id)
  }
  list() {
    return [...this.providers.values()]
  }
}

export const googleMapsConfigSchema = z
  .object({
    apiKey: z.string().min(1).max(512),
    baseUrl: z
      .string()
      .url()
      .refine((value) => {
        const url = new URL(value)
        const testLoopback =
          process.env.INTEGRATION_ALLOW_TEST_PROVIDERS === '1' &&
          process.env.NODE_ENV !== 'production' &&
          url.protocol === 'http:' &&
          ['127.0.0.1', 'localhost'].includes(url.hostname)
        return (
          ((url.protocol === 'https:' && url.hostname === 'maps.googleapis.com') || testLoopback) &&
          !url.username &&
          !url.password
        )
      }, 'Google Maps endpoint must use https://maps.googleapis.com'),
  })
  .strict()

export function validateGoogleMapsConfig(config: unknown) {
  return googleMapsConfigSchema.safeParse(config)
}

export const quickBooksConfigSchema = z
  .object({
    clientId: z.string().min(1).max(512),
    clientSecret: z.string().min(1).max(2048),
    redirectUri: z
      .string()
      .url()
      .refine((value) => {
        const url = new URL(value)
        return (
          url.protocol === 'https:' ||
          (process.env.INTEGRATION_ALLOW_TEST_PROVIDERS === '1' &&
            process.env.NODE_ENV !== 'production' &&
            url.protocol === 'http:' &&
            ['127.0.0.1', 'localhost'].includes(url.hostname))
        )
      }, 'QuickBooks redirect must use HTTPS'),
    apiBaseUrl: z
      .string()
      .url()
      .refine((value) => {
        const url = new URL(value)
        const testLoopback =
          process.env.INTEGRATION_ALLOW_TEST_PROVIDERS === '1' &&
          process.env.NODE_ENV !== 'production' &&
          url.protocol === 'http:' &&
          ['127.0.0.1', 'localhost'].includes(url.hostname)
        return (
          ((url.protocol === 'https:' &&
            ['quickbooks.api.intuit.com', 'sandbox-quickbooks.api.intuit.com'].includes(url.hostname)) ||
            testLoopback) &&
          url.pathname === '/' &&
          !url.username &&
          !url.password
        )
      }, 'QuickBooks API endpoint is not allowed'),
  })
  .strict()

export function validateQuickBooksConfig(config: unknown) {
  return quickBooksConfigSchema.safeParse(config)
}

export function createProviderRegistry() {
  return new IntegrationProviderRegistry()
    .register({
      id: 'google-maps',
      name: 'Google Maps',
      authMode: 'api_key',
      capabilities: ['geocode'],
      readiness: () => {
        const valid = validateGoogleMapsConfig({
          apiKey: process.env.GOOGLE_MAPS_SERVER_API_KEY || '',
          baseUrl: process.env.GOOGLE_MAPS_BASE_URL || 'https://maps.googleapis.com',
        }).success
        return valid ? { ready: true } : { ready: false, reason: 'Server API key is not configured.' }
      },
    })
    .register({
      id: 'quickbooks',
      name: 'QuickBooks Online',
      authMode: 'oauth2',
      capabilities: ['operating_costs'],
      readiness: () =>
        validateQuickBooksConfig({
          clientId: process.env.QUICKBOOKS_CLIENT_ID || '',
          clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || '',
          redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || '',
          apiBaseUrl: process.env.QUICKBOOKS_API_BASE_URL || 'https://quickbooks.api.intuit.com',
        }).success
          ? { ready: true }
          : { ready: false, reason: 'QuickBooks OAuth is not configured with allowed HTTPS endpoints.' },
    })
}

export interface IntegrationCredentialPayload {
  accessToken: string
  refreshToken?: string
  realmId?: string
}
