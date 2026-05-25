import { Client } from 'pg'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../schema/index.js'

/**
 * Open a connection to the given test DB URL and run `fn` with a drizzle
 * instance bound to the full schema. The test DB is assumed to already have
 * the schema (via migrations applied to template_honeyai in startTestPostgres).
 *
 * Phase 1 uses option G (plan §E intro): each E task ends with
 * `drizzle-kit generate` and commits the migration SQL alongside the schema.
 */
export async function withTestDb<T>(
  url: string,
  fn: (db: NodePgDatabase<typeof schema>) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: url })
  await client.connect()
  try {
    const db = drizzle(client, { schema })
    return await fn(db)
  } finally {
    await client.end()
  }
}
