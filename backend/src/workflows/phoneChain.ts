// Pure module: imported by the workflow sandbox, so no I/O here.
export const PHONE_PROVIDERS = ['orionConnect', 'astraDialer', 'nimbusLookup'] as const
export type PhoneProvider = (typeof PHONE_PROVIDERS)[number]

export type PhoneLookupInput = { fullName: string; email: string; jobTitle: string | null }

export type PhoneOutcome =
  | { status: 'found'; phone: string; provider: PhoneProvider }
  | { status: 'not_found' }
  | { status: 'failed' }

export async function runPhoneChain(
  lookup: (provider: PhoneProvider) => Promise<string | null>,
  onProviderStart: (provider: PhoneProvider) => Promise<void>
): Promise<PhoneOutcome> {
  let failures = 0
  for (const provider of PHONE_PROVIDERS) {
    await onProviderStart(provider)
    try {
      const phone = await lookup(provider)
      if (phone) return { status: 'found', phone, provider }
    } catch {
      // Retries exhausted for this provider, fall through to the next one
      failures++
    }
  }
  return { status: failures === PHONE_PROVIDERS.length ? 'failed' : 'not_found' }
}
