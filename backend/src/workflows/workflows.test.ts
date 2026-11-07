import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import path from 'path'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { Worker } from '@temporalio/worker'
import { Context } from '@temporalio/activity'
import { WorkflowFailedError } from '@temporalio/client'
import { verifyEmailWorkflow } from './workflows'

let env: TestWorkflowEnvironment

beforeAll(async () => {
  env = await TestWorkflowEnvironment.createTimeSkipping()
}, 120_000)

afterAll(async () => {
  await env?.teardown()
})

async function runWith(verifyEmail: (email: string) => Promise<boolean>) {
  const worker = await Worker.create({
    connection: env.nativeConnection,
    taskQueue: 'test',
    workflowsPath: path.join(__dirname, 'workflows.ts'),
    activities: { verifyEmail },
  })
  return worker.runUntil(
    env.client.workflow.execute(verifyEmailWorkflow, {
      taskQueue: 'test',
      workflowId: `test-${Math.random()}`,
      args: ['jane.smith@example.com'],
    })
  )
}

describe('verifyEmailWorkflow', () => {
  it('completes when the verifier is slow but answers (slower than the old 1s timeout)', async () => {
    const slow = () => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 3000))
    await expect(runWith(slow)).resolves.toBe(true)
  }, 20_000)

  it('fails within a bounded time when the verifier never answers', async () => {
    // Context.sleep rejects on cancel, so the worker can shut down after the workflow gives up
    const hang = () =>
      Context.current()
        .sleep('1 hour')
        .then(() => true)
    await expect(runWith(hang)).rejects.toBeInstanceOf(WorkflowFailedError)
  }, 60_000)
})
