import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { Client } from 'pg'
import {
  startTestPostgres,
  createTestDatabase,
  dropTestDatabase,
  testDatabaseUrl,
  type TestPgHandle,
} from '../test/container.js'

describe('migrations — run_cost_summary matview', () => {
  let handle: TestPgHandle
  let dbName: string

  beforeAll(async () => {
    handle = await startTestPostgres()
  }, 90_000)
  afterAll(async () => {
    await handle.stop()
  })
  beforeEach(async () => {
    dbName = await createTestDatabase(handle)
  })
  afterEach(async () => {
    await dropTestDatabase(handle, dbName)
  })

  it('creates matview run_cost_summary with unique index after migrate', async () => {
    const url = testDatabaseUrl(handle, dbName)
    const client = new Client({ connectionString: url })
    await client.connect()
    try {
      const mv = await client.query(
        "SELECT 1 FROM pg_matviews WHERE matviewname = 'run_cost_summary'",
      )
      expect(mv.rowCount).toBe(1)
      const idx = await client.query(
        "SELECT indexname FROM pg_indexes WHERE tablename = 'run_cost_summary' AND indexname LIKE '%uniq%'",
      )
      expect(idx.rowCount).toBe(1)
    } finally {
      await client.end()
    }
  })

  it('REFRESH MATERIALIZED VIEW CONCURRENTLY succeeds', async () => {
    const url = testDatabaseUrl(handle, dbName)
    const client = new Client({ connectionString: url })
    await client.connect()
    try {
      await expect(
        client.query('REFRESH MATERIALIZED VIEW CONCURRENTLY run_cost_summary'),
      ).resolves.toBeDefined()
    } finally {
      await client.end()
    }
  })
})
