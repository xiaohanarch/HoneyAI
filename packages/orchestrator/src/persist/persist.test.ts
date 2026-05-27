import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { v7 as uuidv7 } from 'uuid'
import {
  startTestPostgres,
  createTestDatabase,
  dropTestDatabase,
  testDatabaseUrl,
  createDb,
  type TestDb,
} from '../test/container.js'
import type { TestPgHandle } from '@honeyai/db/test'
import { tenants, users } from '@honeyai/db/schema'
import { githubInstallations, repositories } from '@honeyai/db/schema'
import { runs, nodes } from '@honeyai/db/schema'
import { persistRun } from './run.js'
import { persistNode } from './node.js'

// ─── local seed helper ────────────────────────────────────────────────────────

let _seq = 0
const nextSeq = () => ++_seq

async function seedDb(db: TestDb): Promise<{
  tenantId: string
  userId: string
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
  await db.insert(users).values({ id: userId, githubId: 2_000_000 + n, githubLogin: `u-${n}` })
  await db.insert(githubInstallations).values({
    id: installationId,
    installationId: 8_000_000 + n,
    accountLogin: `acme-${n}`,
    accountType: 'Organization',
  })
  await db.insert(repositories).values({
    id: repoId,
    tenantId,
    installationId,
    githubRepoId: 4_000_000 + n,
    owner: 'acme',
    name: `repo-${n}`,
  })
  await db.insert(runs).values({
    id: runId,
    tenantId,
    repositoryId: repoId,
    createdByUserId: userId,
    title: `Run ${n}`,
    oneLiner: 'do something',
  })
  await db.insert(nodes).values({
    id: nodeId,
    runId,
    stage: 1,
    ordinal: 1,
    name: `agent-${n}`,
    kind: 'agent',
  })

  return { tenantId, userId, runId, nodeId }
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

// ─── persistRun tests ─────────────────────────────────────────────────────────

describe('persistRun', () => {
  it('AC-05-02: persistRun — running state sets status=running', async () => {
    // Arrange
    const { runId } = await seedDb(db)

    // Act
    await persistRun(db, runId, { id: runId, status: 'running' })

    // Assert
    const rows = await db.query.runs.findMany({ where: (r, { eq }) => eq(r.id, runId) })
    expect(rows[0]!.status).toBe('running')
    expect(rows[0]!.startedAt).toBeInstanceOf(Date)
    expect(rows[0]!.finishedAt).toBeNull()
  })

  it('AC-05-02: persistRun — failed state with failureClass sets status=failed + failureClass + failureMessage + finishedAt', async () => {
    // Arrange
    const { runId } = await seedDb(db)

    // Act
    await persistRun(db, runId, {
      id: runId,
      status: 'failed',
      failureClass: 'sandbox_timeout',
      failureMessage: 'pod timed out',
    })

    // Assert
    const rows = await db.query.runs.findMany({ where: (r, { eq }) => eq(r.id, runId) })
    expect(rows[0]!.status).toBe('failed')
    expect(rows[0]!.failureClass).toBe('sandbox_timeout')
    expect(rows[0]!.failureMessage).toBe('pod timed out')
    expect(rows[0]!.finishedAt).toBeInstanceOf(Date)
  })

  it('AC-05-02: persistRun — completed state sets finishedAt', async () => {
    // Arrange
    const { runId } = await seedDb(db)

    // Act
    await persistRun(db, runId, { id: runId, status: 'completed' })

    // Assert
    const rows = await db.query.runs.findMany({ where: (r, { eq }) => eq(r.id, runId) })
    expect(rows[0]!.status).toBe('completed')
    expect(rows[0]!.finishedAt).toBeInstanceOf(Date)
  })

  it('AC-05-02: persistRun — cancelled state sets status=cancelled', async () => {
    // Arrange
    const { runId } = await seedDb(db)

    // Act
    await persistRun(db, runId, { id: runId, status: 'cancelled' })

    // Assert
    const rows = await db.query.runs.findMany({ where: (r, { eq }) => eq(r.id, runId) })
    expect(rows[0]!.status).toBe('cancelled')
    expect(rows[0]!.finishedAt).toBeInstanceOf(Date)
  })
})

// ─── persistNode tests ────────────────────────────────────────────────────────

describe('persistNode', () => {
  it('AC-05-02: persistNode — running state increments retryCount + sets status=running', async () => {
    // Arrange
    const { runId, nodeId } = await seedDb(db)

    // Act — retryCount=1 simulates first retry attempt
    await persistNode(db, nodeId, {
      id: nodeId,
      kind: 'agent',
      status: 'running',
      retryCount: 1,
    })

    // Assert
    const rows = await db.query.nodes.findMany({ where: (n, { eq }) => eq(n.id, nodeId) })
    expect(rows[0]!.status).toBe('running')
    expect(rows[0]!.retryCount).toBe(1)
    expect(rows[0]!.startedAt).toBeInstanceOf(Date)
    expect(rows[0]!.finishedAt).toBeNull()
    // suppress unused variable warning
    void runId
  })

  it('AC-05-02: persistNode — failed state sets status=failed + retryCount + finishedAt', async () => {
    // Arrange
    const { nodeId } = await seedDb(db)

    // Act
    await persistNode(db, nodeId, {
      id: nodeId,
      kind: 'agent',
      status: 'failed',
      retryCount: 2,
      failureClass: 'llm_quality_failed',
      failureMessage: 'output quality check failed',
    })

    // Assert
    const rows = await db.query.nodes.findMany({ where: (n, { eq }) => eq(n.id, nodeId) })
    expect(rows[0]!.status).toBe('failed')
    expect(rows[0]!.retryCount).toBe(2)
    expect(rows[0]!.finishedAt).toBeInstanceOf(Date)
  })

  it('AC-05-02: persistNode — success state sets status=success + finishedAt', async () => {
    // Arrange
    const { nodeId } = await seedDb(db)

    // Act
    await persistNode(db, nodeId, {
      id: nodeId,
      kind: 'agent',
      status: 'success',
      retryCount: 0,
    })

    // Assert
    const rows = await db.query.nodes.findMany({ where: (n, { eq }) => eq(n.id, nodeId) })
    expect(rows[0]!.status).toBe('success')
    expect(rows[0]!.finishedAt).toBeInstanceOf(Date)
  })
})
