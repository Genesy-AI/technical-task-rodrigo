import Papa from 'papaparse'

export interface CsvLead {
  firstName: string
  lastName: string
  email: string
  jobTitle?: string
  countryCode?: string
  companyName?: string
  phoneNumber?: string
  yearsAtCompany?: number
  linkedinUrl?: string
  isValid: boolean
  errors: string[]
  // Bad optional values: the field is dropped but the lead still imports
  warnings: string[]
  rowIndex: number
}

// Mirrors parseYearsAtCompany / parseLinkedinUrl in backend/src/utils/leadFields.ts (the backend re-validates)
export const parseYearsAtCompany = (value: string): number | undefined =>
  /^\d{1,3}$/.test(value) && Number(value) <= 100 ? Number(value) : undefined

export const parseLinkedinUrl = (value: string): string | undefined => {
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`)
    const isHttp = url.protocol === 'https:' || url.protocol === 'http:'
    const isLinkedin = url.hostname === 'linkedin.com' || url.hostname.endsWith('.linkedin.com')
    return isHttp && isLinkedin ? url.href : undefined
  } catch {
    return undefined
  }
}

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const parseCsv = (content: string): CsvLead[] => {
  if (!content?.trim()) {
    throw new Error('CSV content cannot be empty')
  }

  const parseResult = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transform: (value) => value.trim(),
    transformHeader: (header) => header.trim().toLowerCase(),
    quoteChar: '"',
  })

  if (parseResult.errors.length > 0) {
    const criticalErrors = parseResult.errors.filter(
      (error) => error.type === 'Delimiter' || error.type === 'Quotes' || error.type === 'FieldMismatch'
    )
    if (criticalErrors.length > 0) {
      throw new Error(`CSV parsing failed: ${criticalErrors[0].message}`)
    }
  }

  if (!parseResult.data || parseResult.data.length === 0) {
    throw new Error('CSV file appears to be empty or contains no valid data')
  }

  const data: CsvLead[] = []

  parseResult.data.forEach((row, index) => {
    if (Object.values(row).every((value) => !value)) return

    const lead: Partial<CsvLead> = { rowIndex: index + 2 }
    const warnings: string[] = []

    Object.entries(row).forEach(([header, value]) => {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z]/g, '')
      const trimmedValue = value?.trim() || ''

      switch (normalizedHeader) {
        case 'firstname':
          lead.firstName = trimmedValue
          break
        case 'lastname':
          lead.lastName = trimmedValue
          break
        case 'email':
          lead.email = trimmedValue
          break
        case 'jobtitle':
          lead.jobTitle = trimmedValue || undefined
          break
        case 'countrycode':
          lead.countryCode = trimmedValue || undefined
          break
        case 'companyname':
          lead.companyName = trimmedValue || undefined
          break
        case 'phonenumber':
        case 'phone':
        case 'mobile':
        case 'mobilenumber':
        case 'telephone':
          lead.phoneNumber = trimmedValue || undefined
          break
        // yearsInRole is what the sample CSVs in docs/ use
        case 'yearsatcompany':
        case 'yearsatcurrentcompany':
        case 'yearsincompany':
        case 'tenure':
        case 'yearsinrole':
          if (!trimmedValue) break
          lead.yearsAtCompany = parseYearsAtCompany(trimmedValue)
          if (lead.yearsAtCompany === undefined) {
            warnings.push(`Years at company "${trimmedValue}" is not a whole number 0-100, ignored`)
          }
          break
        case 'linkedin':
        case 'linkedinurl':
        case 'linkedinprofile':
        case 'linkedinprofileurl':
          if (!trimmedValue) break
          lead.linkedinUrl = parseLinkedinUrl(trimmedValue)
          if (lead.linkedinUrl === undefined) {
            warnings.push(`LinkedIn URL "${trimmedValue}" is not a linkedin.com link, ignored`)
          }
          break
      }
    })

    const errors: string[] = []
    if (!lead.firstName?.trim()) {
      errors.push('First name is required')
    }
    if (!lead.lastName?.trim()) {
      errors.push('Last name is required')
    }
    if (!lead.email?.trim()) {
      errors.push('Email is required')
    } else if (!isValidEmail(lead.email)) {
      errors.push('Invalid email format')
    }

    data.push({
      ...lead,
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      email: lead.email || '',
      isValid: errors.length === 0,
      errors,
      warnings,
    } as CsvLead)
  })

  return data
}
