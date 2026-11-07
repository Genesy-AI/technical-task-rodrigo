import { proxyActivities, type RetryPolicy } from '@temporalio/workflow'
import type * as activities from './activities'
import { runPhoneChain, type PhoneLookupInput, type PhoneOutcome } from './phoneChain'

const { verifyEmail } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 second',
})

export async function verifyEmailWorkflow(email: string): Promise<boolean> {
  return await verifyEmail(email)
}

const phoneLookupRetry: RetryPolicy = {
  maximumAttempts: 3,
  initialInterval: '1 second',
  backoffCoefficient: 2,
}

// Orion is slow (~4s per call in a live test), the other two answer in well under a second
const phoneLookups = {
  orionConnect: proxyActivities<typeof activities>({
    startToCloseTimeout: '10 seconds',
    retry: phoneLookupRetry,
  }),
  astraDialer: proxyActivities<typeof activities>({
    startToCloseTimeout: '3 seconds',
    retry: phoneLookupRetry,
  }),
  nimbusLookup: proxyActivities<typeof activities>({
    startToCloseTimeout: '5 seconds',
    retry: phoneLookupRetry,
  }),
}

const { savePhoneEnrichment } = proxyActivities<typeof activities>({ startToCloseTimeout: '5 seconds' })

export async function enrichPhoneWorkflow(leadId: number, input: PhoneLookupInput): Promise<PhoneOutcome> {
  const outcome = await runPhoneChain(
    (provider) => phoneLookups[provider].lookupPhone(provider, input),
    (provider) => savePhoneEnrichment(leadId, { status: 'running', provider })
  )
  await savePhoneEnrichment(leadId, outcome)
  return outcome
}
