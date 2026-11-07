import { describe, it, expect } from 'vitest'
import { renderPreview, templateFieldKeys } from './template'

const known = new Set(['firstName', 'yearsAtCompany', 'email'])

describe('templateFieldKeys', () => {
  it('returns unique keys in order and ignores invalid patterns', () => {
    expect(templateFieldKeys('{firstName} {email} {firstName} {first-name} {}')).toEqual([
      'firstName',
      'email',
    ])
  })
})

describe('renderPreview', () => {
  it('substitutes values, keeping 0', () => {
    expect(
      renderPreview('{firstName}, {yearsAtCompany} yrs', { firstName: 'Ana', yearsAtCompany: 0 }, known)
    ).toBe('Ana, 0 yrs')
  })

  it('marks missing values and leaves unknown placeholders as typed', () => {
    expect(renderPreview('{email} {nope}', { email: '' }, known)).toBe('[missing email] {nope}')
  })

  it('does not re-substitute or expand $ patterns in values', () => {
    expect(renderPreview('{firstName} {email}', { firstName: '$& {email}', email: 'x@y.z' }, known)).toBe(
      '$& {email} x@y.z'
    )
  })
})
