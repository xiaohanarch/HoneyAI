import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { v7 as uuidv7 } from 'uuid'
import { getTableName } from 'drizzle-orm'
import {
  startTestPostgres,
  createTestDatabase,
  dropTestDatabase,
  testDatabaseUrl,
  type TestPgHandle,
} from '../test/container.js'
import { withTestDb } from '../test/push-schema.js'
import { tenants } from './identity.js'
import { assetSources } from './assets.js'
import { jobs, jobLocks, assetSyncQueue } from './jobs.js'

describe('schema/jobs — metadata', () => {
  it('table names', () => {
    expect(getTableName(jobs)).toBe('jobs')
    expect(getTableName(jobLocks)).toBe('job_locks')
    expect(getTableName(assetSyncQueue)).toBe('asset_sync_queue')
  })
})

describe('schema/jobs — round-trip', () => {
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

  it('inserts a jobs row; default attempts=0', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      await db.insert(jobs).values({
        id: uuidv7(),
        queueName: 'default',
        bullJobId: 'b-1',
        payload: { foo: 'bar' },
        status: 'queued',
      })
      const rows = await db.select().from(jobs)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.attempts).toBe(0)
      expect(rows[0]?.status).toBe('queued')
      expect(rows[0]?.finishedAt).toBeNull()
    })
  })

  it('jobLocks: lockKey is PK; supports basic upsert pattern', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const expiresAt = new Date(Date.now() + 60_000)
      await db.insert(jobLocks).values({
        lockKey: 'node:abc:retry',
        ownerJobId: uuidv7(),
        expiresAt,
      })
      const rows = await db.select().from(jobLocks)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.lockKey).toBe('node:abc:retry')
    })
  })

  it('assetSyncQueue: default status="queued" and FK cascade from asset_sources', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const tenantId = uuidv7()
      const sourceId = uuidv7()
      await db.insert(tenants).values({ id: tenantId, slug: 't', name: 'T' })
      await db.insert(assetSources).values({
        id: sourceId,
        tenantId,
        kind: 'github_repo',
        repoUrl: 'https://github.com/example/repo',
        syncMode: 'manual',
      })
      await db.insert(assetSyncQueue).values({
        id: uuidv7(),
        sourceId,
        scheduledAt: new Date(),
      })
      const rows = await db.select().from(assetSyncQueue)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.status).toBe('queued')
    })
  })
})
