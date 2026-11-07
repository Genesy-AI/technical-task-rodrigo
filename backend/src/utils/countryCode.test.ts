import { describe, it, expect } from 'vitest'
import { normalizeCountryCode } from './countryCode'

describe('normalizeCountryCode', () => {
  it.each([
    ['US', 'US'],
    ['us', 'US'],
    [' gb ', 'GB'],
    ['UK', 'GB'],
    ['usa', 'US'],
  ])('normalizes %j to %s', (input, expected) => {
    expect(normalizeCountryCode(input)).toBe(expected)
  })

  it.each(['XXX', '12', 'ZZ', 'EU', '', '   ', undefined, null, 12, {}])('returns null for %j', (input) => {
    expect(normalizeCountryCode(input)).toBeNull()
  })
})
