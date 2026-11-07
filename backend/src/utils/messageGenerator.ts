import { TEMPLATE_FIELDS, TemplateFieldKey } from './leadFields'

export interface Lead {
  firstName: string
  lastName?: string | null
  email?: string | null
  jobTitle?: string | null
  companyName?: string | null
  countryCode?: string | null
  phoneNumber?: string | null
  yearsAtCompany?: number | null
  linkedinUrl?: string | null
}

const FIELD_KEYS = new Set<string>(TEMPLATE_FIELDS.map((field) => field.key))

// Single pass with a replacer function: values are never re-scanned for {fields} or `$&`-style patterns
export function generateMessageFromTemplate(template: string, lead: Lead): string {
  return template.replace(/\{(\w+)\}/g, (_, fieldName: string) => {
    if (!FIELD_KEYS.has(fieldName)) {
      throw new Error(`Unknown field in template: ${fieldName}`)
    }

    const fieldValue = lead[fieldName as TemplateFieldKey]

    if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
      throw new Error(`Missing required field: ${fieldName}`)
    }

    return String(fieldValue)
  })
}
