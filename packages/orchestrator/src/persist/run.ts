// persistRun — UPDATE runs SET status, failureClass, failureMessage, [finishedAt if terminal]
// Called after reduceRun() to persist the new RunState to DB.

import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { runs } from '@honeyai/db/schema'
import type { RunState } from '../types.js'

// Accept any typed drizzle postgres db (schema-generic)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = NodePgDatabase<any>

const TERMINAL_RUN_STATUSES = new Set<RunState['status']>(['completed', 'failed', 'cancelled'])

/**
 * persistRun — UPDATE runs SET status, failureClass, failureMessage, [finishedAt if terminal].
 * Sets finishedAt=now() when the new status is a terminal status (completed, failed, cancelled).
 */
export async function persistRun(db: AnyDb, runId: string, next: RunState): Promise<void> {
  const now = new Date()
  await db
    .update(runs)
    .set({
      status: next.status,
      failureClass: next.failureClass ?? null,
      failureMessage: next.failureMessage ?? null,
      ...(TERMINAL_RUN_STATUSES.has(next.status) ? { finishedAt: now } : {}),
    })
    .where(eq(runs.id, runId))
}
