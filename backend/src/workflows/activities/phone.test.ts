import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { ApplicationFailure } from '@temporalio/client'
import { lookupPhone } from './phone'

const input = { fullName: 'Ada Lovelace', email: 'ada@example.com', jobTitle: 'CTO' }

function mockFetch(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status, headers }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function sentRequest(fetchMock: ReturnType<typeof mockFetch>) {
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
  return { url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) }
}

beforeEach(() => {
  vi.stubEnv('ORION_CONNECT_API_KEY', 'orion-key')
  vi.stubEnv('ASTRA_DIALER_API_KEY', 'astra-key')
  vi.stubEnv('NIMBUS_LOOKUP_API_KEY', 'nimbus key')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('provider adapters', () => {
  it('orionConnect sends name + email domain with header auth', async () => {
    const fetchMock = mockFetch(200, { phone: '2020027544' })
    expect(await lookupPhone('orionConnect', input)).toBe('2020027544')
    const req = sentRequest(fetchMock)
    expect(req.url).toBe('https://api.enginy.ai/api/tmp/orionConnect')
    expect(req.headers['x-auth-me']).toBe('orion-key')
    expect(req.body).toEqual({ fullName: 'Ada Lovelace', companyWebsite: 'example.com' })
  })

  it('astraDialer treats a missing phoneNmbr as no data', async () => {
    const fetchMock = mockFetch(200, {})
    expect(await lookupPhone('astraDialer', input)).toBeNull()
    const req = sentRequest(fetchMock)
    expect(req.headers.apiKey).toBe('astra-key')
    expect(req.body).toEqual({ email: 'ada@example.com' })
  })

  it('nimbusLookup authenticates via query param and reads numeric phones', async () => {
    const fetchMock = mockFetch(200, { phoneNmbr: 3568435525, countryCode: 'ES' })
    expect(await lookupPhone('nimbusLookup', input)).toBe('3568435525')
    const req = sentRequest(fetchMock)
    expect(req.url).toBe('https://api.enginy.ai/api/tmp/numbusLookup?api=nimbus%20key')
    expect(req.body).toEqual({ email: 'ada@example.com', jobTitle: 'CTO' })
  })

  it('nimbusLookup also accepts the documented `number` field', async () => {
    mockFetch(200, { number: 123, countryCode: 'ES' })
    expect(await lookupPhone('nimbusLookup', { ...input, jobTitle: null })).toBe('123')
  })
})

describe('lookupPhone errors', () => {
  it('429 is retryable and honors Retry-After', async () => {
    mockFetch(429, {}, { 'Retry-After': '7' })
    const error = await lookupPhone('astraDialer', input).catch((e) => e)
    expect(error).toBeInstanceOf(ApplicationFailure)
    expect(error.nonRetryable).toBe(false)
    expect(error.nextRetryDelay).toBe(7000)
  })

  it('other 4xx are not retried', async () => {
    mockFetch(401)
    const error = await lookupPhone('astraDialer', input).catch((e) => e)
    expect(error.nonRetryable).toBe(true)
  })

  it('5xx is a plain retryable error', async () => {
    mockFetch(503)
    const error = await lookupPhone('astraDialer', input).catch((e) => e)
    expect(error).not.toBeInstanceOf(ApplicationFailure)
    expect(error.message).toContain('503')
  })

  it('a missing API key fails without calling the provider', async () => {
    vi.stubEnv('ASTRA_DIALER_API_KEY', '')
    const fetchMock = mockFetch(200)
    const error = await lookupPhone('astraDialer', input).catch((e) => e)
    expect(error.nonRetryable).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
