// persistNode — UPDATE nodes SET status, retryCount, [finishedAt if terminal]
// Called after reduceNode() to persist the new NodeState to DB.
// Note: nodes table does not have failureClass / failureMessage columns;
//       those are stored on node_retries rows (managed separately in Phase 2+).

import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { nodes } from '@honeyai/db/schema'
import type { NodeState } from '../types.js'

// Accept any typed drizzle postgres db (schema-generic)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = NodePgDatabase<any>

const TERMINAL_NODE_STATUSES = new Set<NodeState['status']>(['success', 'failed', 'skipped'])

/**
 * persistNode — UPDATE nodes SET status, retryCount, [finishedAt if terminal].
 * Sets finishedAt=now() when the new status is a terminal status (success, failed, skipped).
 * failureClass and failureMessage are carried in NodeState for FSM logic but are not
 * columns on the nodes table — they are stored in node_retries (Phase 2+).
 */
export async function persistNode(db: AnyDb, nodeId: string, next: NodeState): Promise<void> {
  const now = new Date()
  await db
    .update(nodes)
    .set({
      status: next.status,
      retryCount: next.retryCount,
      ...(TERMINAL_NODE_STATUSES.has(next.status) ? { finishedAt: now } : {}),
      ...(next.status === 'running' ? { startedAt: now } : {}),
    })
    .where(eq(nodes.id, nodeId))
}
