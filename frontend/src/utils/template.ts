const PLACEHOLDER = /\{(\w+)\}/g

export const templateFieldKeys = (template: string): string[] => [
  ...new Set(Array.from(template.matchAll(PLACEHOLDER), (match) => match[1])),
]

export const isMissingValue = (value: unknown): boolean =>
  value === null || value === undefined || value === ''

// Display-only mirror of backend generateMessageFromTemplate; the backend stays authoritative.
// Unknown placeholders are left as typed, missing values are shown inline instead of throwing.
export const renderPreview = (
  template: string,
  lead: Record<string, unknown>,
  knownKeys: Set<string>
): string =>
  template.replace(PLACEHOLDER, (match, key: string) => {
    if (!knownKeys.has(key)) return match
    return isMissingValue(lead[key]) ? `[missing ${key}]` : String(lead[key])
  })
