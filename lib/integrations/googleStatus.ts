import { validCoordinates } from './coordinates'

type Location = { lat?: number; lng?: number } | null
export type GoogleOutcome = { kind: 'APPLY' } | { kind: 'RETRY' | 'DEAD_LETTER'; errorCode: string }

export function classifyGoogleGeocode(status: string | undefined, location: Location): GoogleOutcome {
  if (status === 'OK')
    return location && validCoordinates(location.lat, location.lng)
      ? { kind: 'APPLY' }
      : { kind: 'DEAD_LETTER', errorCode: 'INVALID_COORDINATES' }
  if (status === 'ZERO_RESULTS') return { kind: 'DEAD_LETTER', errorCode: 'ZERO_RESULTS' }
  if (status === 'OVER_QUERY_LIMIT') return { kind: 'RETRY', errorCode: 'QUOTA_EXCEEDED' }
  if (status === 'UNKNOWN_ERROR') return { kind: 'RETRY', errorCode: 'PROVIDER_TRANSIENT_ERROR' }
  if (status === 'REQUEST_DENIED') return { kind: 'RETRY', errorCode: 'PROVIDER_CONFIGURATION_ERROR' }
  if (status === 'INVALID_REQUEST') return { kind: 'DEAD_LETTER', errorCode: 'INVALID_REQUEST' }
  return { kind: 'RETRY', errorCode: 'UNKNOWN_PROVIDER_STATUS' }
}
