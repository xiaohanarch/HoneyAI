// pgNotify — thin wrapper over drizzle sql`` for PostgreSQL LISTEN/NOTIFY
// Used by handlers to push SSE events to web layer.

import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = NodePgDatabase<any>

export async function pgNotify(db: AnyDb, channel: string, payload: unknown): Promise<void> {
  await db.execute(sql`SELECT pg_notify(${channel}, ${JSON.stringify(payload)})`)
}
