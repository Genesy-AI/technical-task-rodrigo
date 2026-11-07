import { describe, it, expect } from 'vitest'
import { optionalText, parseLinkedinUrl, parseYearsAtCompany, TEMPLATE_FIELDS } from './leadFields'

describe('TEMPLATE_FIELDS', () => {
  it('has unique keys', () => {
    const keys = TEMPLATE_FIELDS.map((field) => field.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('optionalText', () => {
  it('trims and keeps leading zeros', () => {
    expect(optionalText('  005-190-0118 ')).toBe('005-190-0118')
  })

  it('maps blank and non-strings to null', () => {
    expect(optionalText('')).toBeNull()
    expect(optionalText('   ')).toBeNull()
    expect(optionalText(undefined)).toBeNull()
    expect(optionalText(123)).toBeNull()
  })
})

describe('parseYearsAtCompany', () => {
  it('keeps 0', () => {
    expect(parseYearsAtCompany('0')).toBe(0)
    expect(parseYearsAtCompany(0)).toBe(0)
  })

  it('parses whole numbers up to the max', () => {
    expect(parseYearsAtCompany(' 15 ')).toBe(15)
    expect(parseYearsAtCompany('05')).toBe(5)
    expect(parseYearsAtCompany('100')).toBe(100)
  })

  it('never turns blank into 0', () => {
    expect(parseYearsAtCompany('')).toBeNull()
    expect(parseYearsAtCompany('  ')).toBeNull()
    expect(parseYearsAtCompany(null)).toBeNull()
    expect(parseYearsAtCompany(undefined)).toBeNull()
  })

  it('rejects non-integers, negatives, junk and out-of-range', () => {
    for (const value of ['2.5', '-1', '2 years', 'abc', '101', '1e2', 2.5, -1, NaN]) {
      expect(parseYearsAtCompany(value)).toBeNull()
    }
  })
})

describe('parseLinkedinUrl', () => {
  it('accepts linkedin.com and subdomains', () => {
    expect(parseLinkedinUrl('https://www.linkedin.com/in/ana')).toBe('https://www.linkedin.com/in/ana')
    expect(parseLinkedinUrl('https://linkedin.com/in/ana')).toBe('https://linkedin.com/in/ana')
  })

  it('adds https when the scheme is missing', () => {
    expect(parseLinkedinUrl('linkedin.com/in/ana')).toBe('https://linkedin.com/in/ana')
  })

  it('rejects other hosts, lookalikes and unsafe schemes', () => {
    for (const value of [
      'https://example.com/in/ana',
      'https://notlinkedin.com/in/ana',
      'https://linkedin.com.evil.io/in/ana',
      'javascript:alert(1)',
      'ftp://linkedin.com/in/ana',
      'not a url',
      '',
    ]) {
      expect(parseLinkedinUrl(value)).toBeNull()
    }
  })
})
