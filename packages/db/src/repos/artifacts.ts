import { and, asc, eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from '../schema/index.js'
import { artifacts } from '../schema/artifacts.js'

export type NewArtifact = typeof artifacts.$inferInsert
export type Artifact = typeof artifacts.$inferSelect

export type InsertArtifactInput = Pick<
  NewArtifact,
  'tenantId' | 'runId' | 'nodeId' | 'kind' | 'blobSha256' | 'authorKind'
> &
  Partial<Pick<NewArtifact, 'attempt' | 'status' | 'authorUserId' | 'metadata' | 'pinned' | 'id'>>

export type InsertArtifactResult = {
  row: Artifact
  /** `true` if a new row was inserted; `false` if the unique key collided
   *  and we returned the existing row from the post-conflict re-select. */
  created: boolean
}

/**
 * Inserts an artifact row idempotently under the
 * `(run_id, node_id, attempt, kind)` unique constraint
 * (`artifacts_uniq_node_attempt_kind` — see E6 / AC-03-03).
 *
 * On conflict the existing row is returned with `created: false`. Callers
 * can therefore call this from at-least-once delivery code (BullMQ retry,
 * inbound webhook replay) without manual duplicate-check.
 */
export async function insertArtifactIdempotent(
  db: NodePgDatabase<typeof schema>,
  input: InsertArtifactInput,
): Promise<InsertArtifactResult> {
  const id = input.id ?? uuidv7()
  const attempt = input.attempt ?? 1

  const [inserted] = await db
    .insert(artifacts)
    .values({ ...input, id, attempt })
    .onConflictDoNothing()
    .returning()

  if (inserted) return { row: inserted, created: true }

  // Conflict path — re-select the row that beat us by the unique key.
  // nodeId can be null in the schema; this repo only supports node-scoped
  // artifacts (Phase 1 use cases), so we require nodeId here.
  if (input.nodeId == null) {
    throw new Error(
      'insertArtifactIdempotent: ON CONFLICT path requires nodeId to re-select; got null',
    )
  }

  const [existing] = await db
    .select()
    .from(artifacts)
    .where(
      and(
        eq(artifacts.runId, input.runId),
        eq(artifacts.nodeId, input.nodeId),
        eq(artifacts.attempt, attempt),
        eq(artifacts.kind, input.kind),
      ),
    )
    .limit(1)

  if (!existing) {
    throw new Error(
      'insertArtifactIdempotent: ON CONFLICT but no existing row found on re-select — schema invariant violated',
    )
  }
  return { row: existing, created: false }
}

/**
 * Lists all artifacts for a node, ordered by `attempt` ascending so callers
 * can walk through retry history in chronological order.
 */
export async function listArtifactsByNode(
  db: NodePgDatabase<typeof schema>,
  nodeId: string,
): Promise<Artifact[]> {
  return db
    .select()
    .from(artifacts)
    .where(eq(artifacts.nodeId, nodeId))
    .orderBy(asc(artifacts.attempt))
}
