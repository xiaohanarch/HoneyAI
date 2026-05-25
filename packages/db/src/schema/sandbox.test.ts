import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { v7 as uuidv7 } from 'uuid'
import { getTableName } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from './index.js'
import {
  startTestPostgres,
  createTestDatabase,
  dropTestDatabase,
  testDatabaseUrl,
  type TestPgHandle,
} from '../test/container.js'
import { withTestDb } from '../test/push-schema.js'
import { tenants, users } from './identity.js'
import { githubInstallations, repositories } from './github.js'
import { runs } from './runs.js'
import { sandboxStatusEnum, sandboxes, sandboxCredentials } from './sandbox.js'

type Db = NodePgDatabase<typeof schema>

async function seedRun(db: Db) {
  const tenantId = uuidv7()
  const userId = uuidv7()
  const installationRowId = uuidv7()
  const repoId = uuidv7()
  const runId = uuidv7()
  await db.insert(tenants).values({ id: tenantId, slug: 't', name: 'T' })
  await db.insert(users).values({ id: userId, githubId: 1, githubLogin: 'u' })
  await db.insert(githubInstallations).values({
    id: installationRowId,
    installationId: 1,
    accountLogin: 't',
    accountType: 'User',
  })
  await db.insert(repositories).values({
    id: repoId,
    tenantId,
    installationId: installationRowId,
    githubRepoId: 1,
    owner: 't',
    name: 'r',
  })
  await db.insert(runs).values({
    id: runId,
    tenantId,
    repositoryId: repoId,
    createdByUserId: userId,
    title: 't',
    oneLiner: 't',
  })
  return { runId }
}

describe('schema/sandbox — metadata', () => {
  it('sandbox_status enum has 4 values', () => {
    expect(sandboxStatusEnum.enumValues).toEqual(['pending', 'running', 'terminated', 'failed'])
  })

  it('table names', () => {
    expect(getTableName(sandboxes)).toBe('sandboxes')
    expect(getTableName(sandboxCredentials)).toBe('sandbox_credentials')
  })
})

describe('schema/sandbox — round-trip', () => {
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

  it('inserts a sandbox row with all defaults', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const { runId } = await seedRun(db)
      await db.insert(sandboxes).values({
        id: uuidv7(),
        runId,
        jobName: 'sb-job-1',
        imageDigest: 'sha256:abc',
      })
      const rows = await db.select().from(sandboxes)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.namespace).toBe('honeyai')
      expect(rows[0]?.resourceCpu).toBe('2')
      expect(rows[0]?.resourceMemory).toBe('2Gi')
      expect(rows[0]?.resourceStorage).toBe('5Gi')
      expect(rows[0]?.status).toBe('pending')
    })
  })

  it('sandboxes.runId is UNIQUE (one sandbox per run)', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const { runId } = await seedRun(db)
      await db.insert(sandboxes).values({
        id: uuidv7(),
        runId,
        jobName: 'job-a',
        imageDigest: 'sha256:1',
      })
      await expect(
        db.insert(sandboxes).values({
          id: uuidv7(),
          runId,
          jobName: 'job-b',
          imageDigest: 'sha256:2',
        }),
      ).rejects.toThrow(/unique|duplicate/i)
    })
  })

  it('inserts sandbox_credentials linked to a sandbox', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const { runId } = await seedRun(db)
      const sandboxId = uuidv7()
      await db.insert(sandboxes).values({
        id: sandboxId,
        runId,
        jobName: 'j',
        imageDigest: 'sha256:1',
      })
      await db.insert(sandboxCredentials).values({
        id: uuidv7(),
        sandboxId,
        kind: 'github_token',
        encryptedValue: 'enc',
        dekId: uuidv7(),
      })
      const rows = await db.select().from(sandboxCredentials)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.kind).toBe('github_token')
      expect(rows[0]?.injectedAt).toBeInstanceOf(Date)
    })
  })
})
