// packages/worker/src/handlers/artifact-content.ts
// Reconstructs artifact content by concatenating text event payloads in seq order.

import { eq, and } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '@honeyai/db/schema'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = NodePgDatabase<any>

/**
 * Reconstruct artifact content from the events table.
 *
 * 1. Find artifact by blobSha256 → get nodeId
 * 2. SELECT all events WHERE nodeId = artifact.nodeId AND kind = 'text' ORDER BY seq ASC
 * 3. Concatenate all payload.content values (skip undefined)
 */
export async function getArtifactContent(db: AnyDb, blobSha256: string): Promise<string> {
  // 1. Find artifact by blob_sha256 to get nodeId
  const artifactRows = await db
    .select()
    .from(schema.artifacts)
    .where(eq(schema.artifacts.blobSha256, blobSha256))
    .limit(1)

  const artifact = artifactRows[0]
  if (!artifact || !artifact.nodeId) {
    throw new Error(`getArtifactContent: artifact not found for sha256=${blobSha256}`)
  }

  // 2. SELECT all text events for this node, ordered by seq ASC
  const eventRows = await db
    .select()
    .from(schema.events)
    .where(and(eq(schema.events.nodeId, artifact.nodeId), eq(schema.events.kind, 'text')))
    .orderBy(schema.events.seq)

  // 3. Concatenate content from all text events (skip undefined/non-string)
  if (eventRows.length === 0) {
    throw new Error(`getArtifactContent: no text events found for nodeId=${artifact.nodeId}`)
  }

  return eventRows
    .map((e) => {
      const p = e.payload as Record<string, unknown>
      return typeof p['content'] === 'string' ? p['content'] : ''
    })
    .join('')
}
