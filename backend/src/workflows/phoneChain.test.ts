import { describe, it, expect, vi } from 'vitest'
import { runPhoneChain, type PhoneProvider } from './phoneChain'

function run(answers: Record<PhoneProvider, string | null | Error>) {
  const lookup = vi.fn(async (provider: PhoneProvider) => {
    const answer = answers[provider]
    if (answer instanceof Error) throw answer
    return answer
  })
  const onProviderStart = vi.fn(async () => {})
  return { lookup, onProviderStart, outcome: runPhoneChain(lookup, onProviderStart) }
}

describe('runPhoneChain', () => {
  it('stops at the first provider that finds a phone', async () => {
    const { lookup, onProviderStart, outcome } = run({
      orionConnect: '555',
      astraDialer: '666',
      nimbusLookup: '777',
    })
    expect(await outcome).toEqual({ status: 'found', phone: '555', provider: 'orionConnect' })
    expect(lookup).toHaveBeenCalledTimes(1)
    expect(onProviderStart).toHaveBeenCalledTimes(1)
  })

  it('falls through empty and failing providers in order', async () => {
    const { lookup, onProviderStart, outcome } = run({
      orionConnect: new Error('timeout'),
      astraDialer: null,
      nimbusLookup: '777',
    })
    expect(await outcome).toEqual({ status: 'found', phone: '777', provider: 'nimbusLookup' })
    expect(lookup.mock.calls.map(([provider]) => provider)).toEqual([
      'orionConnect',
      'astraDialer',
      'nimbusLookup',
    ])
    expect(onProviderStart).toHaveBeenCalledTimes(3)
  })

  it('is not_found when at least one provider answered without a phone', async () => {
    const { outcome } = run({ orionConnect: new Error('x'), astraDialer: null, nimbusLookup: new Error('y') })
    expect(await outcome).toEqual({ status: 'not_found' })
  })

  it('is failed when every provider errored', async () => {
    const { outcome } = run({
      orionConnect: new Error('x'),
      astraDialer: new Error('y'),
      nimbusLookup: new Error('z'),
    })
    expect(await outcome).toEqual({ status: 'failed' })
  })
})
