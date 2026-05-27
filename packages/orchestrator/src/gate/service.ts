// Gate Service — DB layer (spec 05 §10.3)
// Provides pauseRunAtGate / viewGate / passGate / resumeFromGate.
// All functions accept a typed Drizzle db instance and perform atomic SQL operations.

import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { gates, runs, nodes } from '@honeyai/db/schema'

// Accept any typed drizzle postgres db (schema-generic)
// The actual test helper binds the full schema so query.*  works there;
// the service only uses table references, which are compatible.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = NodePgDatabase<any>

export type PassGateResult = { ok: true } | { ok: false; reason: 'not_viewed' }

/**
 * pauseRunAtGate — INSERT gates row with openedAt=now(), UPDATE run.status → 'paused_at_gate'.
 * Both mutations are wrapped in a transaction to guarantee atomicity.
 */
export async function pauseRunAtGate(db: AnyDb, runId: string, nodeId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(gates).values({ nodeId, openedAt: new Date() })
    await tx.update(runs).set({ status: 'paused_at_gate' }).where(eq(runs.id, runId))
  })
}

/**
 * viewGate — UPDATE gates.viewed_at = now() WHERE node_id = nodeId.
 */
export async function viewGate(db: AnyDb, nodeId: string): Promise<void> {
  await db.update(gates).set({ viewedAt: new Date() }).where(eq(gates.nodeId, nodeId))
}

/**
 * passGate — Guard: viewedAt must be set first.
 * On success: UPDATE gates SET passed_at=now(), passed_by_user_id=userId;
 *             UPDATE runs SET status='running' WHERE id=(node's runId).
 * The gate update, node lookup, and run update are wrapped in a single transaction.
 * Throws if the gate row or node row does not exist.
 * // TODO Phase 2.3: add versionMismatch check + pinnedArtifactId validation
 */
export async function passGate(db: AnyDb, nodeId: string, userId: string): Promise<PassGateResult> {
  // SELECT the gate row — done outside the transaction so we can return early without aborting
  const gateRows = await db.select().from(gates).where(eq(gates.nodeId, nodeId))
  const gate = gateRows[0]

  if (!gate) throw new Error(`passGate: gate not found for nodeId=${nodeId}`)
  if (!gate.viewedAt) return { ok: false, reason: 'not_viewed' }

  await db.transaction(async (tx) => {
    await tx
      .update(gates)
      .set({ passedAt: new Date(), passedByUserId: userId })
      .where(eq(gates.nodeId, nodeId))

    const nodeRows = await tx.select({ runId: nodes.runId }).from(nodes).where(eq(nodes.id, nodeId))
    const node = nodeRows[0]
    if (!node) throw new Error(`passGate: node not found for nodeId=${nodeId}`)
    await tx.update(nodes).set({ status: 'success' }).where(eq(nodes.id, nodeId))
    await tx.update(runs).set({ status: 'running' }).where(eq(runs.id, node.runId))
  })

  return { ok: true }
}

/**
 * resumeFromGate — Human-in-the-loop decision:
 *   'approve' → delegates to passGate (viewedAt guard applies).
 *   'reject'  → UPDATE runs SET status='cancelled'.
 */
export async function resumeFromGate(
  db: AnyDb,
  runId: string,
  nodeId: string,
  userId: string,
  decision: 'approve' | 'reject',
): Promise<PassGateResult | void> {
  if (decision === 'approve') {
    return passGate(db, nodeId, userId)
  }
  // decision === 'reject'
  await db.update(runs).set({ status: 'cancelled' }).where(eq(runs.id, runId))
}
