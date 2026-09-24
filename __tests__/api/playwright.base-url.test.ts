import { LOCAL_BASE_URL, resolveBaseURL } from '../../e2e/support/base-url'

describe('Playwright base URL guard', () => {
  it('defaults to the local server, never production', () => {
    expect(resolveBaseURL({})).toEqual({ baseURL: LOCAL_BASE_URL, remote: false })
    expect(resolveBaseURL({ PLAYWRIGHT_TEST_BASE_URL: '  ' }).remote).toBe(false)
  })

  it('allows explicit non-production remote targets', () => {
    expect(resolveBaseURL({ PLAYWRIGHT_TEST_BASE_URL: 'https://staging.example.test' }))
      .toEqual({ baseURL: 'https://staging.example.test', remote: true })
  })

  it.each(['https://fleet.ashbi.ca', 'https://FLEET.ashbi.ca/', 'https://www.fleet.ashbi.ca', 'https://fleet.ashbi.ca.:443'])(
    'refuses production host %s without an explicit override', (url) => {
      expect(() => resolveBaseURL({ PLAYWRIGHT_TEST_BASE_URL: url })).toThrow(/PLAYWRIGHT_ALLOW_PRODUCTION=1/)
    })

  it('allows production only with PLAYWRIGHT_ALLOW_PRODUCTION=1', () => {
    expect(resolveBaseURL({ PLAYWRIGHT_TEST_BASE_URL: 'https://fleet.ashbi.ca', PLAYWRIGHT_ALLOW_PRODUCTION: '1' }).baseURL)
      .toBe('https://fleet.ashbi.ca')
    expect(() => resolveBaseURL({ PLAYWRIGHT_TEST_BASE_URL: 'https://fleet.ashbi.ca', PLAYWRIGHT_ALLOW_PRODUCTION: 'true' })).toThrow()
  })

  it('rejects malformed URLs', () => {
    expect(() => resolveBaseURL({ PLAYWRIGHT_TEST_BASE_URL: 'fleet.ashbi.ca' })).toThrow(/not a valid URL/)
  })
})
