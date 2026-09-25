import { classifyGoogleGeocode } from '@/lib/integrations/googleStatus'

describe('Google geocode status policy', () => {
  it.each([
    ['ZERO_RESULTS', 'DEAD_LETTER', 'ZERO_RESULTS'],
    ['OVER_QUERY_LIMIT', 'RETRY', 'QUOTA_EXCEEDED'],
    ['UNKNOWN_ERROR', 'RETRY', 'PROVIDER_TRANSIENT_ERROR'],
    ['REQUEST_DENIED', 'RETRY', 'PROVIDER_CONFIGURATION_ERROR'],
    ['INVALID_REQUEST', 'DEAD_LETTER', 'INVALID_REQUEST'],
    ['SOMETHING_NEW', 'RETRY', 'UNKNOWN_PROVIDER_STATUS'],
  ] as const)('classifies %s truthfully', (status, outcome, errorCode) => {
    expect(classifyGoogleGeocode(status, null)).toEqual({ kind: outcome, errorCode })
  })

  it('applies only bounded coordinates from an OK response', () => {
    expect(classifyGoogleGeocode('OK', { lat: 43.65, lng: -79.38 })).toEqual({ kind: 'APPLY' })
    expect(classifyGoogleGeocode('OK', { lat: 91, lng: 0 })).toEqual({
      kind: 'DEAD_LETTER',
      errorCode: 'INVALID_COORDINATES',
    })
  })
})
