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
import {
  runStatusEnum,
  nodeStatusEnum,
  nodeKindEnum,
  failureClassEnum,
  runs,
  nodes,
  gates,
  events,
  nodeRetries,
} from './runs.js'

describe('schema/runs — metadata', () => {
  it('run_status enum has 7 values', () => {
    expect(runStatusEnum.enumValues).toEqual([
      'created',
      'scheduling',
      'running',
      'paused_at_gate',
      'completed',
      'failed',
      'cancelled',
    ])
  })

  it('node_status enum has 5 values', () => {
    expect(nodeStatusEnum.enumValues).toEqual([
      'pending',
      'running',
      'success',
      'failed',
      'skipped',
    ])
  })

  it('node_kind enum has 4 values', () => {
    expect(nodeKindEnum.enumValues).toEqual(['agent', 'gate', 'merge', 'deploy'])
  })

  it('failure_class enum has 8 values', () => {
    expect(failureClassEnum.enumValues).toEqual([
      'llm_rate_limited',
      'llm_quality_failed',
      'sandbox_timeout',
      'sandbox_oom',
      'sandbox_died',
      'sandbox_disk_full',
      'external_failed',
      'user_cancelled',
    ])
  })

  it('table names', () => {
    expect(getTableName(runs)).toBe('runs')
    expect(getTableName(nodes)).toBe('nodes')
    expect(getTableName(gates)).toBe('gates')
    expect(getTableName(events)).toBe('events')
    expect(getTableName(nodeRetries)).toBe('node_retries')
  })
})

type Db = NodePgDatabase<typeof schema>

async function seedTenantUserRepo(db: Db) {
  const tenantId = uuidv7()
  const userId = uuidv7()
  const installationRowId = uuidv7()
  const repoId = uuidv7()
  await db.insert(tenants).values({ id: tenantId, slug: 'co', name: 'Co' })
  await db.insert(users).values({ id: userId, githubId: 1, githubLogin: 'u' })
  await db.insert(githubInstallations).values({
    id: installationRowId,
    installationId: 100,
    accountLogin: 'co',
    accountType: 'Organization',
  })
  await db.insert(repositories).values({
    id: repoId,
    tenantId,
    installationId: installationRowId,
    githubRepoId: 200,
    owner: 'co',
    name: 'app',
  })
  return { tenantId, userId, repoId }
}

describe('schema/runs — round-trip', () => {
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

  it('inserts a runs row with default status="created", runtime="claude_code", cost=0', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const { tenantId, userId, repoId } = await seedTenantUserRepo(db)
      const runId = uuidv7()
      await db.insert(runs).values({
        id: runId,
        tenantId,
        repositoryId: repoId,
        createdByUserId: userId,
        title: 'add login',
        oneLiner: 'add login button',
      })
      const rows = await db.select().from(runs)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.status).toBe('created')
      expect(rows[0]?.runtime).toBe('claude_code')
      expect(rows[0]?.targetBranch).toBe('main')
      expect(rows[0]?.totalCostMicroUsd).toBe(0n)
    })
  })

  it('inserts nodes and events; events.seq is bigint', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const { tenantId, userId, repoId } = await seedTenantUserRepo(db)
      const runId = uuidv7()
      const nodeId = uuidv7()
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
        name: 'stage2.design',
        kind: 'agent',
      })
      await db.insert(events).values({
        id: uuidv7(),
        runId,
        nodeId,
        seq: 1n,
        kind: 'node.started',
        payload: { foo: 'bar' },
      })
      const evRows = await db.select().from(events)
      expect(evRows).toHaveLength(1)
      expect(typeof evRows[0]?.seq).toBe('bigint')
      expect(evRows[0]?.seq).toBe(1n)
    })
  })

  it('gates uses nodeId as primary key', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const { tenantId, userId, repoId } = await seedTenantUserRepo(db)
      const runId = uuidv7()
      const nodeId = uuidv7()
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
        stage: 1,
        ordinal: 1,
        name: 'gate1',
        kind: 'gate',
      })
      await db.insert(gates).values({ nodeId })
      await expect(db.insert(gates).values({ nodeId })).rejects.toThrow(/duplicate|unique|primary/i)
    })
  })

  it('node_retries records attempt + failure_class', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const { tenantId, userId, repoId } = await seedTenantUserRepo(db)
      const runId = uuidv7()
      const nodeId = uuidv7()
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
        stage: 3,
        ordinal: 1,
        name: 'code',
        kind: 'agent',
      })
      await db.insert(nodeRetries).values({
        id: uuidv7(),
        nodeId,
        attempt: 2,
        trigger: 'manual',
        failureClass: 'sandbox_timeout',
      })
      const rows = await db.select().from(nodeRetries)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.attempt).toBe(2)
      expect(rows[0]?.failureClass).toBe('sandbox_timeout')
    })
  })
})
