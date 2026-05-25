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
import { runs, nodes } from './runs.js'
import { artifactKindEnum, artifactStatusEnum, artifactBlobs, artifacts } from './artifacts.js'

type Db = NodePgDatabase<typeof schema>

async function seedRun(db: Db) {
  const tenantId = uuidv7()
  const userId = uuidv7()
  const installationRowId = uuidv7()
  const repoId = uuidv7()
  const runId = uuidv7()
  const nodeId = uuidv7()
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
  await db.insert(nodes).values({
    id: nodeId,
    runId,
    stage: 2,
    ordinal: 1,
    name: 'design',
    kind: 'agent',
  })
  return { tenantId, runId, nodeId }
}

describe('schema/artifacts — metadata', () => {
  it('artifact_kind enum has 7 values', () => {
    expect(artifactKindEnum.enumValues).toEqual([
      'requirement_ir',
      'design_ir',
      'design_sub_ir',
      'impl_ir',
      'pr_meta',
      'log_chunk',
      'raw_input',
    ])
  })

  it('artifact_status enum is {ok, failed}', () => {
    expect(artifactStatusEnum.enumValues).toEqual(['ok', 'failed'])
  })

  it('table names', () => {
    expect(getTableName(artifactBlobs)).toBe('artifact_blobs')
    expect(getTableName(artifacts)).toBe('artifacts')
  })
})

describe('schema/artifacts — round-trip', () => {
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

  it('inserts an artifact with defaults attempt=1, status=ok, pinned=false', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const { tenantId, runId, nodeId } = await seedRun(db)
      const sha = 'a'.repeat(64)
      await db.insert(artifactBlobs).values({
        sha256: sha,
        byteSize: 100n,
        ossKey: `${tenantId}/blobs/${sha.slice(0, 2)}/${sha.slice(2)}`,
      })
      const artifactId = uuidv7()
      await db.insert(artifacts).values({
        id: artifactId,
        tenantId,
        runId,
        nodeId,
        kind: 'design_ir',
        blobSha256: sha,
        authorKind: 'agent',
      })
      const rows = await db.select().from(artifacts)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.attempt).toBe(1)
      expect(rows[0]?.status).toBe('ok')
      expect(rows[0]?.pinned).toBe(false)
      expect(rows[0]?.metadata).toEqual({})
    })
  })

  it('artifact_blobs.ossKey is UNIQUE', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const sha1 = '1'.repeat(64)
      const sha2 = '2'.repeat(64)
      await db.insert(artifactBlobs).values({
        sha256: sha1,
        byteSize: 1n,
        ossKey: 'k1',
      })
      await expect(
        db.insert(artifactBlobs).values({ sha256: sha2, byteSize: 2n, ossKey: 'k1' }),
      ).rejects.toThrow(/unique|duplicate/i)
    })
  })

  it('enforces UNIQUE (runId, nodeId, attempt, kind) on artifacts', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const { tenantId, runId, nodeId } = await seedRun(db)
      const sha = 'b'.repeat(64)
      await db.insert(artifactBlobs).values({ sha256: sha, byteSize: 1n, ossKey: 'k' })
      await db.insert(artifacts).values({
        id: uuidv7(),
        tenantId,
        runId,
        nodeId,
        kind: 'design_ir',
        blobSha256: sha,
        authorKind: 'agent',
      })
      await expect(
        db.insert(artifacts).values({
          id: uuidv7(),
          tenantId,
          runId,
          nodeId,
          attempt: 1,
          kind: 'design_ir',
          blobSha256: sha,
          authorKind: 'agent',
        }),
      ).rejects.toThrow(/unique|duplicate/i)
    })
  })

  it('attempt=2 retry creates a new row alongside attempt=1 (immutable layer)', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const { tenantId, runId, nodeId } = await seedRun(db)
      const sha = 'c'.repeat(64)
      await db.insert(artifactBlobs).values({ sha256: sha, byteSize: 1n, ossKey: 'k' })
      await db.insert(artifacts).values({
        id: uuidv7(),
        tenantId,
        runId,
        nodeId,
        kind: 'design_ir',
        attempt: 1,
        blobSha256: sha,
        authorKind: 'agent',
      })
      await db.insert(artifacts).values({
        id: uuidv7(),
        tenantId,
        runId,
        nodeId,
        kind: 'design_ir',
        attempt: 2,
        blobSha256: sha,
        authorKind: 'agent',
      })
      const rows = await db.select().from(artifacts)
      expect(rows).toHaveLength(2)
    })
  })
})
