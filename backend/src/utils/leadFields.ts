// Single source of truth for template fields: used by the generator and served to the UI via GET /leads/fields
export const TEMPLATE_FIELDS = [
  { key: 'firstName', label: 'First name', group: 'Person' },
  { key: 'lastName', label: 'Last name', group: 'Person' },
  { key: 'jobTitle', label: 'Job title', group: 'Person' },
  { key: 'countryCode', label: 'Country code', group: 'Person' },
  { key: 'companyName', label: 'Company name', group: 'Company' },
  { key: 'yearsAtCompany', label: 'Years at company', group: 'Company' },
  { key: 'email', label: 'Email', group: 'Contact' },
  { key: 'phoneNumber', label: 'Phone number', group: 'Contact' },
  { key: 'linkedinUrl', label: 'LinkedIn URL', group: 'Contact' },
] as const

export type TemplateFieldKey = (typeof TEMPLATE_FIELDS)[number]['key']

export const MAX_YEARS_AT_COMPANY = 100

export const optionalText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

// Strict: '' -> null (never 0), '0' -> 0, rejects '2.5', '-1', '2 years'
export const parseYearsAtCompany = (value: unknown): number | null => {
  const text = typeof value === 'number' ? String(value) : optionalText(value)
  if (!text || !/^\d{1,3}$/.test(text)) return null
  const years = Number(text)
  return years <= MAX_YEARS_AT_COMPANY ? years : null
}

// Accepts http(s) URLs on linkedin.com or a subdomain; a missing scheme defaults to https
export const parseLinkedinUrl = (value: unknown): string | null => {
  const text = optionalText(value)
  if (!text) return null
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`)
    const isHttp = url.protocol === 'https:' || url.protocol === 'http:'
    const isLinkedin = url.hostname === 'linkedin.com' || url.hostname.endsWith('.linkedin.com')
    return isHttp && isLinkedin ? url.href : null
  } catch {
    return null
  }
}
