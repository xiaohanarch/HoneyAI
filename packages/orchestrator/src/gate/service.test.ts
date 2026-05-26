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
import { pauseRunAtGate, viewGate, passGate, resumeFromGate } from './service.js'

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
  await db.insert(users).values({ id: userId, githubId: 1_000_000 + n, githubLogin: `u-${n}` })
  await db.insert(githubInstallations).values({
    id: installationId,
    installationId: 9_000_000 + n,
    accountLogin: `acme-${n}`,
    accountType: 'Organization',
  })
  await db.insert(repositories).values({
    id: repoId,
    tenantId,
    installationId,
    githubRepoId: 5_000_000 + n,
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
    name: `gate-${n}`,
    kind: 'gate',
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

// ─── tests ────────────────────────────────────────────────────────────────────

describe('pauseRunAtGate', () => {
  it('inserts a gates row and sets run.status to paused_at_gate', async () => {
    // Arrange
    const { runId, nodeId } = await seedDb(db)

    // Act
    await pauseRunAtGate(db, runId, nodeId)

    // Assert – gates row exists with openedAt set
    const gateRows = await db.query.gates.findMany({ where: (g, { eq }) => eq(g.nodeId, nodeId) })
    expect(gateRows).toHaveLength(1)
    expect(gateRows[0]!.nodeId).toBe(nodeId)
    expect(gateRows[0]!.openedAt).toBeInstanceOf(Date)

    // Assert – run.status updated to paused_at_gate
    const runRows = await db.query.runs.findMany({ where: (r, { eq }) => eq(r.id, runId) })
    expect(runRows[0]!.status).toBe('paused_at_gate')
  })
})

describe('viewGate', () => {
  it('updates gates.viewed_at', async () => {
    // Arrange
    const { runId, nodeId } = await seedDb(db)
    await pauseRunAtGate(db, runId, nodeId)

    // Act
    await viewGate(db, nodeId)

    // Assert
    const gateRows = await db.query.gates.findMany({ where: (g, { eq }) => eq(g.nodeId, nodeId) })
    expect(gateRows[0]!.viewedAt).toBeInstanceOf(Date)
  })
})

describe('passGate', () => {
  it('returns {ok: false, reason: "not_viewed"} when gate has not been viewed', async () => {
    // Arrange
    const { userId, runId, nodeId } = await seedDb(db)
    await pauseRunAtGate(db, runId, nodeId)
    // NOT calling viewGate

    // Act
    const result = await passGate(db, nodeId, userId)

    // Assert
    expect(result).toEqual({ ok: false, reason: 'not_viewed' })
  })

  it('returns {ok: true} and updates run.status to running + gates.passed_at when gate has been viewed', async () => {
    // Arrange
    const { userId, runId, nodeId } = await seedDb(db)
    await pauseRunAtGate(db, runId, nodeId)
    await viewGate(db, nodeId)

    // Act
    const result = await passGate(db, nodeId, userId)

    // Assert result
    expect(result).toEqual({ ok: true })

    // Assert gates.passed_at set + passed_by_user_id
    const gateRows = await db.query.gates.findMany({ where: (g, { eq }) => eq(g.nodeId, nodeId) })
    expect(gateRows[0]!.passedAt).toBeInstanceOf(Date)
    expect(gateRows[0]!.passedByUserId).toBe(userId)

    // Assert run.status = running
    const runRows = await db.query.runs.findMany({ where: (r, { eq }) => eq(r.id, runId) })
    expect(runRows[0]!.status).toBe('running')
  })
})

describe('resumeFromGate', () => {
  it('approve: delegates to passGate and returns {ok: true}, run.status=running', async () => {
    // Arrange
    const { userId, runId, nodeId } = await seedDb(db)
    await pauseRunAtGate(db, runId, nodeId)
    await viewGate(db, nodeId)

    // Act
    const result = await resumeFromGate(db, runId, nodeId, userId, 'approve')

    // Assert
    expect(result).toEqual({ ok: true })

    const runRows = await db.query.runs.findMany({ where: (r, { eq }) => eq(r.id, runId) })
    expect(runRows[0]!.status).toBe('running')
  })

  it('reject: sets run.status to cancelled', async () => {
    // Arrange
    const { userId, runId, nodeId } = await seedDb(db)
    await pauseRunAtGate(db, runId, nodeId)

    // Act
    await resumeFromGate(db, runId, nodeId, userId, 'reject')

    // Assert
    const runRows = await db.query.runs.findMany({ where: (r, { eq }) => eq(r.id, runId) })
    expect(runRows[0]!.status).toBe('cancelled')
  })
})
