// handleFailure — classify error, decide retry vs fail, persist to DB.
// spec 05 §4.1 + §12: retry policy table, shouldAutoRetry, nextBackoffMs

import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import {
  OrchestratorError,
  shouldAutoRetry,
  nextBackoffMs,
  persistRun,
  persistNode,
} from '@honeyai/orchestrator'
import type { NodeKind } from '@honeyai/orchestrator'
import type { FailureClass } from '@honeyai/orchestrator'
import { pgNotify } from '../notify.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = NodePgDatabase<any>

export type RetrySignal = { action: 'retry'; delayMs: number } | { action: 'fail' }

/**
 * handleFailure — classify error, decide retry vs fail.
 *
 * retryable + under max → return { action: 'retry', delayMs }
 * non-retryable or exhausted → UPDATE node+run to failed, pg_notify, return { action: 'fail' }
 *
 * @param db         Drizzle db instance
 * @param err        The error thrown by executeNode or other handler code
 * @param runId      The run UUID
 * @param nodeId     The node UUID
 * @param nodeKind   The node kind (agent|gate|merge|deploy)
 * @param retryCount Current retry count (0-indexed, i.e. 0 = first failure)
 */
export async function handleFailure(
  db: AnyDb,
  err: unknown,
  runId: string,
  nodeId: string,
  nodeKind: NodeKind,
  retryCount: number,
): Promise<RetrySignal> {
  // If it's a known orchestrator error and still within retry budget → retry
  if (err instanceof OrchestratorError && shouldAutoRetry(err.kind, retryCount)) {
    return { action: 'retry', delayMs: nextBackoffMs(err.kind, retryCount) }
  }

  // Determine failure class and message
  const failureClass: FailureClass = err instanceof OrchestratorError ? err.kind : 'external_failed'
  const failureMessage = err instanceof Error ? err.message : String(err)

  // Persist node to failed
  await persistNode(db, nodeId, {
    id: nodeId,
    kind: nodeKind,
    status: 'failed',
    retryCount,
    failureClass,
    failureMessage,
  })

  // Persist run to failed
  await persistRun(db, runId, {
    id: runId,
    status: 'failed',
    failureClass,
    failureMessage,
  })

  // Notify SSE channel
  await pgNotify(db, `run:${runId}`, { type: 'run_failed', failureClass })

  return { action: 'fail' }
}
