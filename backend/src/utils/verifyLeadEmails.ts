import type { Client } from '@temporalio/client'
import { verifyEmailWorkflow } from '../workflows'

type Lead = { id: number; email: string; firstName: string; lastName: string }

export async function verifyLeadEmails(client: Pick<Client, 'workflow'>, leads: Lead[]) {
  const settled = await Promise.allSettled(
    leads.map((lead) =>
      client.workflow.execute(verifyEmailWorkflow, {
        taskQueue: 'myQueue',
        // One workflow per lead: a repeat request joins the running check instead of starting a duplicate
        workflowId: `verify-email-${lead.id}`,
        workflowIdConflictPolicy: 'USE_EXISTING',
        args: [lead.email],
      })
    )
  )

  const results: Array<{ leadId: number; emailVerified: boolean }> = []
  const errors: Array<{ leadId: number; leadName: string; error: string }> = []
  settled.forEach((outcome, i) => {
    const lead = leads[i]
    if (outcome.status === 'fulfilled') {
      results.push({ leadId: lead.id, emailVerified: Boolean(outcome.value) })
      return
    }
    // WorkflowFailedError -> ActivityFailure -> TimeoutFailure: the innermost message says what happened
    let cause = outcome.reason
    while (cause?.cause) cause = cause.cause
    errors.push({
      leadId: lead.id,
      leadName: `${lead.firstName} ${lead.lastName}`.trim(),
      error: cause instanceof Error ? cause.message : 'Unknown error',
    })
  })
  return { results, errors }
}
