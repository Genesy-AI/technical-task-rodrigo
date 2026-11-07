import { proxyActivities } from '@temporalio/workflow'
import type * as activities from './activities'

// Bounded: Temporal's default retry policy is unlimited, so a verifier slower than the timeout retried forever.
const { verifyEmail } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
  scheduleToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 3 },
})

export async function verifyEmailWorkflow(email: string): Promise<boolean> {
  return await verifyEmail(email)
}
