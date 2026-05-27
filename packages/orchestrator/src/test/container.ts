// Re-export testcontainers helpers from @honeyai/db/test
// so orchestrator tests don't need to declare @testcontainers/postgresql directly.
export {
  startTestPostgres,
  createTestDatabase,
  dropTestDatabase,
  testDatabaseUrl,
} from '@honeyai/db/test'

import { drizzle } from 'drizzle-orm/node-postgres'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Client } from 'pg'
import * as schema from '@honeyai/db/schema'

export type TestDb = NodePgDatabase<typeof schema>

/**
 * createDb — connect to a test database URL and return a drizzle instance.
 * Caller is responsible for calling client.end() after test.
 */
export async function createDb(url: string): Promise<{ db: TestDb; end: () => Promise<void> }> {
  const client = new Client({ connectionString: url })
  await client.connect()
  const db = drizzle(client, { schema })
  return { db, end: () => client.end() }
}
