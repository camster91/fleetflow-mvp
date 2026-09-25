import { validCoordinates } from '@/lib/integrations/coordinates'

describe('Google coordinate validation', () => {
  it.each([
    [90, 180],
    [-90, -180],
    [43.65, -79.38],
  ])('accepts bounded coordinates', (lat, lng) => expect(validCoordinates(lat, lng)).toBe(true))
  it.each([
    [90.0001, 0],
    [-90.1, 0],
    [0, 180.1],
    [0, -181],
    [NaN, 0],
    [0, Infinity],
  ])('rejects invalid coordinates', (lat, lng) => expect(validCoordinates(lat, lng)).toBe(false))
})
