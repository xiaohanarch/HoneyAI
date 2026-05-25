import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { v7 as uuidv7 } from 'uuid'
import { getTableName, eq, and, desc } from 'drizzle-orm'
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
import { irStageEnum, irDocuments } from './ir-documents.js'

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
  return { tenantId, userId, runId }
}

describe('schema/ir-documents — metadata', () => {
  it('ir_stage enum has 3 values', () => {
    expect(irStageEnum.enumValues).toEqual(['requirement', 'design', 'implementation'])
  })

  it('table is named "ir_documents"', () => {
    expect(getTableName(irDocuments)).toBe('ir_documents')
  })
})

describe('schema/ir-documents — round-trip', () => {
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

  it('inserts an ir_documents row created by agent (null user_id)', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const { tenantId, runId } = await seedRun(db)
      await db.insert(irDocuments).values({
        runId,
        stage: 'requirement',
        version: 1,
        tenantId,
        body: '# Req\n\nbody',
        frontmatterJson: { title: 'Req' },
        createdByKind: 'agent',
      })
      const rows = await db.select().from(irDocuments)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.createdByUserId).toBeNull()
      expect(rows[0]?.createdByKind).toBe('agent')
      expect(rows[0]?.frontmatterJson).toEqual({ title: 'Req' })
    })
  })

  it('PK (runId, stage, version) prevents duplicate version', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const { tenantId, runId } = await seedRun(db)
      await db.insert(irDocuments).values({
        runId,
        stage: 'design',
        version: 1,
        tenantId,
        body: 'v1',
        frontmatterJson: {},
        createdByKind: 'agent',
      })
      await expect(
        db.insert(irDocuments).values({
          runId,
          stage: 'design',
          version: 1,
          tenantId,
          body: 'dup',
          frontmatterJson: {},
          createdByKind: 'user',
        }),
      ).rejects.toThrow(/duplicate|unique|primary/i)
    })
  })

  it('append-only: version 1 and 2 coexist; latest fetched by ORDER BY version DESC LIMIT 1', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const { tenantId, userId, runId } = await seedRun(db)
      await db.insert(irDocuments).values({
        runId,
        stage: 'requirement',
        version: 1,
        tenantId,
        body: 'v1 body',
        frontmatterJson: {},
        createdByKind: 'agent',
      })
      await db.insert(irDocuments).values({
        runId,
        stage: 'requirement',
        version: 2,
        tenantId,
        body: 'v2 body',
        frontmatterJson: {},
        createdByUserId: userId,
        createdByKind: 'user',
      })
      const all = await db.select().from(irDocuments)
      expect(all).toHaveLength(2)
      const latest = await db
        .select()
        .from(irDocuments)
        .where(and(eq(irDocuments.runId, runId), eq(irDocuments.stage, 'requirement')))
        .orderBy(desc(irDocuments.version))
        .limit(1)
      expect(latest[0]?.version).toBe(2)
      expect(latest[0]?.body).toBe('v2 body')
      expect(latest[0]?.createdByKind).toBe('user')
    })
  })
})
