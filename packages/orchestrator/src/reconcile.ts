// reconcile.ts — Reconcile Sweep (spec 05 §6 + §13)
// Scans DB for stale active runs and marks them failed if the pod is gone.

import { and, inArray, lt, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { runs } from '@honeyai/db/schema'
import { persistRun } from './persist/run.js'
import type { RunState } from './types.js'

// Accept any typed drizzle postgres db (schema-generic)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = NodePgDatabase<any>

// ─── Pod status types ─────────────────────────────────────────────────────────

/** Injectable pod status checker — k8s in production, mock in tests. */
export type PodStatus =
  | { status: 'running' }
  | { status: 'pending'; ageMs: number }
  | { status: 'failed'; message: string }
  | { status: 'not_found' }

export type PodChecker = (tenantId: string, runId: string) => Promise<PodStatus>

// ─── Thresholds ───────────────────────────────────────────────────────────────

const STALE_THRESHOLD_MS = 10 * 60 * 1000 // 10 minutes
const PENDING_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes

// ─── Core sweep ───────────────────────────────────────────────────────────────

/**
 * reconcileSweep — scan DB for stale active runs and mark failed if pod is gone.
 *
 * Spec 05 §6:
 *   1. runs WHERE status IN ('scheduling','running','paused_at_gate') AND updated_at < now() - 10min
 *   2. check pod status via k8s (injected checker)
 *   3. pod not found  → Run marked failed (sandbox_died)
 *   4. pod Pending > 15min → Run marked failed (sandbox_timeout)
 *   5. pod Failed    → Run marked failed (sandbox_died)
 *
 * Returns number of runs that were marked failed (skipped/still-alive runs are not counted).
 */
export async function reconcileSweep(db: AnyDb, checker: PodChecker): Promise<number> {
  // 1. Find stale active runs
  const staleRuns = await db
    .select({ id: runs.id, tenantId: runs.tenantId, status: runs.status })
    .from(runs)
    .where(
      and(
        inArray(runs.status, ['scheduling', 'running', 'paused_at_gate']),
        lt(runs.updatedAt, sql`NOW() - INTERVAL '10 minutes'`),
      ),
    )

  let processed = 0

  for (const run of staleRuns) {
    const pod = await checker(run.tenantId, run.id)
    const next = buildFailedState(run, pod)
    if (next) {
      await persistRun(db, run.id, next)
      processed++
    }
  }

  return processed
}

// ─── State builder ────────────────────────────────────────────────────────────

function buildFailedState(run: { id: string; status: string }, pod: PodStatus): RunState | null {
  switch (pod.status) {
    case 'running':
      // Pod is alive — do nothing
      return null

    case 'not_found':
      return {
        id: run.id,
        status: 'failed',
        failureClass: 'sandbox_died',
        failureMessage: 'Pod not found',
      }

    case 'failed':
      return {
        id: run.id,
        status: 'failed',
        failureClass: 'sandbox_died',
        failureMessage: pod.message,
      }

    case 'pending':
      if (pod.ageMs >= PENDING_TIMEOUT_MS) {
        return {
          id: run.id,
          status: 'failed',
          failureClass: 'sandbox_timeout',
          failureMessage: `Pod pending ${Math.round(pod.ageMs / 60_000)}min`,
        }
      }
      // Pending but not yet timed out — skip
      return null

    default:
      return null
  }
}

// ─── Interval loop ────────────────────────────────────────────────────────────

/**
 * startReconcileLoop — start a setInterval-based reconcile loop.
 * Returns a cleanup function that stops the loop.
 */
export function startReconcileLoop(
  db: AnyDb,
  checker: PodChecker,
  intervalMs = STALE_THRESHOLD_MS,
): () => void {
  const timer = setInterval(() => {
    reconcileSweep(db, checker).catch((err) => {
      // pino will be wired in Phase 2.3 — console.warn for now
      console.warn('[reconcile] sweep error:', err)
    })
  }, intervalMs)
  return () => clearInterval(timer)
}
