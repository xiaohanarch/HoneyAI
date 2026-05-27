import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { v7 as uuidv7 } from 'uuid'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Client } from 'pg'
import * as schema from '@honeyai/db/schema'
import {
  startTestPostgres,
  createTestDatabase,
  dropTestDatabase,
  testDatabaseUrl,
  type TestPgHandle,
} from '@honeyai/db/test'
import { tenants, users, githubInstallations, repositories, runs, nodes } from '@honeyai/db/schema'
import { SandboxTimeoutError, LlmRateLimitedError } from '@honeyai/orchestrator'
import { handleFailure } from '../handlers/failure.js'

// ─── types ────────────────────────────────────────────────────────────────────

type TestDb = NodePgDatabase<typeof schema>

// ─── DB connection helper ─────────────────────────────────────────────────────

async function createDb(url: string): Promise<{ db: TestDb; end: () => Promise<void> }> {
  const client = new Client({ connectionString: url })
  await client.connect()
  const db = drizzle(client, { schema })
  return { db, end: () => client.end() }
}

// ─── seed helper ──────────────────────────────────────────────────────────────

let _seq = 0
const nextSeq = () => ++_seq

async function seedDb(db: TestDb): Promise<{
  tenantId: string
  runId: string
  nodeId: string
}> {
  const n = nextSeq()
  const tenantId = uuidv7()
  const userId = uuidv7()
  const installationId = uuidv7()
  const repoId = uuidv7()
  const runId = uuidv7()
  const nodeId = uuidv7()

  await db.insert(tenants).values({ id: tenantId, slug: `t-${n}`, name: `Tenant ${n}` })
  await db.insert(users).values({ id: userId, githubId: 3_000_000 + n, githubLogin: `u-fail-${n}` })
  await db.insert(githubInstallations).values({
    id: installationId,
    installationId: 9_000_000 + n,
    accountLogin: `acme-fail-${n}`,
    accountType: 'Organization',
  })
  await db.insert(repositories).values({
    id: repoId,
    tenantId,
    installationId,
    githubRepoId: 5_000_000 + n,
    owner: 'acme',
    name: `repo-fail-${n}`,
  })
  await db.insert(runs).values({
    id: runId,
    tenantId,
    repositoryId: repoId,
    createdByUserId: userId,
    title: `Run ${n}`,
    oneLiner: 'test failure handler',
    status: 'running',
  })
  await db.insert(nodes).values({
    id: nodeId,
    runId,
    stage: 1,
    ordinal: 1,
    name: `agent-fail-${n}`,
    kind: 'agent',
    status: 'running',
  })

  return { tenantId, runId, nodeId }
}

// ─── testcontainers lifecycle ─────────────────────────────────────────────────

let handle: TestPgHandle
let dbName: string
let db: TestDb
let end: () => Promise<void>

beforeAll(async () => {
  handle = await startTestPostgres()
}, 120_000)

afterAll(async () => {
  await handle.stop()
})

beforeEach(async () => {
  dbName = await createTestDatabase(handle)
  const conn = await createDb(testDatabaseUrl(handle, dbName))
  db = conn.db
  end = conn.end
})

afterEach(async () => {
  await end()
  await dropTestDatabase(handle, dbName)
})

// ─── handleFailure tests ──────────────────────────────────────────────────────

describe('handleFailure', () => {
  it('AC-02-05: SandboxTimeoutError (non-retryable) → action=fail, node+run set to failed in DB', async () => {
    // Arrange
    const { runId, nodeId } = await seedDb(db)
    const err = new SandboxTimeoutError('pod timed out')

    // Act
    const result = await handleFailure(db, err, runId, nodeId, 'agent', 0)

    // Assert — return value
    expect(result).toEqual({ action: 'fail' })

    // Assert — DB run updated to failed
    const runRows = await db.query.runs.findMany({ where: (r, { eq }) => eq(r.id, runId) })
    expect(runRows[0]!.status).toBe('failed')
    expect(runRows[0]!.failureClass).toBe('sandbox_timeout')
    expect(runRows[0]!.failureMessage).toBe('pod timed out')
    expect(runRows[0]!.finishedAt).toBeInstanceOf(Date)

    // Assert — DB node updated to failed
    const nodeRows = await db.query.nodes.findMany({ where: (n, { eq }) => eq(n.id, nodeId) })
    expect(nodeRows[0]!.status).toBe('failed')
    expect(nodeRows[0]!.finishedAt).toBeInstanceOf(Date)
  }, 30_000)

  it('AC-02-05: LlmRateLimitedError attempt=0 (retryable, under max) → action=retry, delayMs=5000', async () => {
    // Arrange
    const { runId, nodeId } = await seedDb(db)
    const err = new LlmRateLimitedError('rate limited')

    // Act
    const result = await handleFailure(db, err, runId, nodeId, 'agent', 0)

    // Assert — retry signal
    expect(result).toEqual({ action: 'retry', delayMs: 5_000 })

    // Assert — DB unchanged (still running)
    const runRows = await db.query.runs.findMany({ where: (r, { eq }) => eq(r.id, runId) })
    expect(runRows[0]!.status).toBe('running')

    const nodeRows = await db.query.nodes.findMany({ where: (n, { eq }) => eq(n.id, nodeId) })
    expect(nodeRows[0]!.status).toBe('running')
  }, 30_000)

  it('AC-02-05: LlmRateLimitedError attempt=3 (retryable but exhausted) → action=fail', async () => {
    // Arrange
    const { runId, nodeId } = await seedDb(db)
    // retryCount=3 equals max=3 → shouldAutoRetry returns false
    const err = new LlmRateLimitedError('rate limit exhausted')

    // Act
    const result = await handleFailure(db, err, runId, nodeId, 'agent', 3)

    // Assert — fail signal
    expect(result).toEqual({ action: 'fail' })

    // Assert — DB run updated to failed
    const runRows = await db.query.runs.findMany({ where: (r, { eq }) => eq(r.id, runId) })
    expect(runRows[0]!.status).toBe('failed')
    expect(runRows[0]!.failureClass).toBe('llm_rate_limited')
  }, 30_000)

  it('AC-02-05: unknown error (not OrchestratorError) → action=fail, failureClass=external_failed', async () => {
    // Arrange
    const { runId, nodeId } = await seedDb(db)
    const err = new Error('something unexpected')

    // Act
    const result = await handleFailure(db, err, runId, nodeId, 'agent', 0)

    // Assert — fail signal
    expect(result).toEqual({ action: 'fail' })

    // Assert — DB run updated with external_failed
    const runRows = await db.query.runs.findMany({ where: (r, { eq }) => eq(r.id, runId) })
    expect(runRows[0]!.status).toBe('failed')
    expect(runRows[0]!.failureClass).toBe('external_failed')
    expect(runRows[0]!.failureMessage).toBe('something unexpected')
  }, 30_000)
})
