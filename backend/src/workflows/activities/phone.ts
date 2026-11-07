import { ApplicationFailure } from '@temporalio/client'
import { prisma } from '../../db'
import type { PhoneLookupInput, PhoneOutcome, PhoneProvider } from '../phoneChain'

type ProviderRequest = { url: string; headers?: Record<string, string>; body: Record<string, unknown> }
type PhoneAdapter = {
  request: (input: PhoneLookupInput) => ProviderRequest
  parse: (body: any) => string | null
}

const BASE_URL = 'https://api.enginy.ai/api/tmp'

function apiKey(name: string): string {
  const value = process.env[name]
  if (!value) throw ApplicationFailure.nonRetryable(`${name} is not set`, 'MissingApiKey')
  return value
}

function phoneOrNull(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && value.trim()) return value.trim()
  return null
}

// One adapter per provider: builds its request (input shape + auth) and normalizes its response.
export const PHONE_ADAPTERS: Record<PhoneProvider, PhoneAdapter> = {
  orionConnect: {
    request: ({ fullName, email }) => ({
      url: `${BASE_URL}/orionConnect`,
      headers: { 'x-auth-me': apiKey('ORION_CONNECT_API_KEY') },
      // shortcut: leads have no website column, so the email domain stands in for it (wrong for gmail etc.)
      body: { fullName, companyWebsite: email.split('@')[1] ?? '' },
    }),
    parse: (body) => phoneOrNull(body?.phone),
  },
  astraDialer: {
    request: ({ email }) => ({
      url: `${BASE_URL}/astraDialer`,
      headers: { apiKey: apiKey('ASTRA_DIALER_API_KEY') },
      body: { email },
    }),
    parse: (body) => phoneOrNull(body?.phoneNmbr),
  },
  nimbusLookup: {
    request: ({ email, jobTitle }) => ({
      url: `${BASE_URL}/numbusLookup?api=${encodeURIComponent(apiKey('NIMBUS_LOOKUP_API_KEY'))}`,
      body: jobTitle ? { email, jobTitle } : { email },
    }),
    // Docs say `number`, the live API answers `phoneNmbr`
    parse: (body) => phoneOrNull(body?.number ?? body?.phoneNmbr),
  },
}

export async function lookupPhone(provider: PhoneProvider, input: PhoneLookupInput): Promise<string | null> {
  const { url, headers, body } = PHONE_ADAPTERS[provider].request(input)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('retry-after'))
    throw ApplicationFailure.create({
      message: `${provider} rate limited`,
      type: 'RateLimited',
      // Honor the provider's Retry-After instead of our own backoff when it sends one
      nextRetryDelay: retryAfter > 0 ? retryAfter * 1000 : undefined,
    })
  }
  if (res.status >= 400 && res.status < 500) {
    throw ApplicationFailure.nonRetryable(
      `${provider} rejected the request (${res.status})`,
      'ProviderClientError'
    )
  }
  if (!res.ok) throw new Error(`${provider} failed (${res.status})`)

  return PHONE_ADAPTERS[provider].parse(await res.json())
}

export type PhoneEnrichmentState = PhoneOutcome | { status: 'running'; provider: PhoneProvider }

export async function savePhoneEnrichment(leadId: number, state: PhoneEnrichmentState): Promise<void> {
  // updateMany so a lead deleted mid-run is a no-op instead of an endless retry
  await prisma.lead.updateMany({
    where: { id: leadId },
    data: {
      phoneEnrichmentStatus: state.status,
      phoneEnrichmentProvider: 'provider' in state ? state.provider : null,
      ...(state.status === 'found' && { phoneNumber: state.phone }),
    },
  })
}
