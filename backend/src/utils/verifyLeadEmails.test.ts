import { describe, expect, it, vi } from 'vitest'
import { verifyLeadEmails } from './verifyLeadEmails'

const lead = (id: number) => ({ id, email: `l${id}@x.com`, firstName: 'Lead', lastName: String(id) })

describe('verifyLeadEmails', () => {
  it('starts every lead at once instead of one after another', async () => {
    const pending: Array<(v: boolean) => void> = []
    const execute = vi.fn(() => new Promise<boolean>((resolve) => pending.push(resolve)))
    const run = verifyLeadEmails({ workflow: { execute } } as any, [lead(1), lead(2), lead(3)])

    await Promise.resolve()
    expect(execute).toHaveBeenCalledTimes(3)
    for (const resolve of pending) resolve(true)
    await run
  })

  it('uses one workflow id per lead and joins a running one', async () => {
    const execute = vi.fn(async () => true)
    await verifyLeadEmails({ workflow: { execute } } as any, [lead(7)])
    expect(execute).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ workflowId: 'verify-email-7', workflowIdConflictPolicy: 'USE_EXISTING' })
    )
  })

  it('reports a timeout as an error, never as an invalid email', async () => {
    const withCause = (message: string, cause?: Error) => Object.assign(new Error(message), { cause })
    const timeout = withCause(
      'Workflow execution failed',
      withCause('Activity task failed', withCause('activity ScheduleToClose timeout'))
    )
    const execute = vi.fn(async (_wf: unknown, opts: { args: string[] }) => {
      if (opts.args[0] === 'l2@x.com') throw timeout
      return opts.args[0] !== 'l3@x.com'
    })

    const { results, errors } = await verifyLeadEmails({ workflow: { execute } } as any, [
      lead(1),
      lead(2),
      lead(3),
    ])

    expect(results).toEqual([
      { leadId: 1, emailVerified: true },
      { leadId: 3, emailVerified: false },
    ])
    expect(errors).toEqual([{ leadId: 2, leadName: 'Lead 2', error: 'activity ScheduleToClose timeout' }])
  })
})
