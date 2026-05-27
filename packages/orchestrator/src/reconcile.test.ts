import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { v7 as uuidv7 } from 'uuid'
import { sql } from 'drizzle-orm'
import {
  startTestPostgres,
  createTestDatabase,
  dropTestDatabase,
  testDatabaseUrl,
  createDb,
  type TestDb,
} from './test/container.js'
import type { TestPgHandle } from '@honeyai/db/test'
import { tenants, users } from '@honeyai/db/schema'
import { githubInstallations, repositories } from '@honeyai/db/schema'
import { runs } from '@honeyai/db/schema'
import { reconcileSweep } from './reconcile.js'
import type { PodChecker } from './reconcile.js'

// ─── local seed helper ────────────────────────────────────────────────────────

let _seq = 0
const nextSeq = () => ++_seq

async function seedDb(db: TestDb): Promise<{
  tenantId: string
  userId: string
  runId: string
}> {
  const n = nextSeq()
  const tenantId = uuidv7()
  const userId = uuidv7()
  const installationId = uuidv7()
  const repoId = uuidv7()
  const runId = uuidv7()

  await db.insert(tenants).values({ id: tenantId, slug: `t-${n}`, name: `Tenant ${n}` })
  await db.insert(users).values({ id: userId, githubId: 3_000_000 + n, githubLogin: `u-${n}` })
  await db.insert(githubInstallations).values({
    id: installationId,
    installationId: 7_000_000 + n,
    accountLogin: `acme-${n}`,
    accountType: 'Organization',
  })
  await db.insert(repositories).values({
    id: repoId,
    tenantId,
    installationId,
    githubRepoId: 6_000_000 + n,
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

  return { tenantId, userId, runId }
}

/** Helper: backdate a run's updated_at to 11 minutes ago to make it "stale". */
async function makeStale(db: TestDb, runId: string): Promise<void> {
  await db.execute(
    sql`UPDATE runs SET updated_at = NOW() - INTERVAL '11 minutes' WHERE id = ${runId}`,
  )
}

/** Helper: set a run's status to the given active status. */
async function setRunStatus(
  db: TestDb,
  runId: string,
  status: 'scheduling' | 'running' | 'paused_at_gate',
): Promise<void> {
  await db.execute(sql`UPDATE runs SET status = ${status} WHERE id = ${runId}`)
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
  vi.restoreAllMocks()
  await end()
  await dropTestDatabase(handle, dbName)
})

// ─── reconcileSweep tests ─────────────────────────────────────────────────────

describe('reconcileSweep', () => {
  it('AC-05-04: fresh run (updated_at=now) → reconcile skips it, status unchanged', async () => {
    // Arrange — run inserted now (updated_at = default NOW()), status = 'running'
    const { runId } = await seedDb(db)
    await setRunStatus(db, runId, 'running')
    // Do NOT call makeStale — run is fresh

    const checker: PodChecker = vi.fn().mockResolvedValue({ status: 'not_found' })

    // Act
    const processed = await reconcileSweep(db, checker)

    // Assert — no runs processed, status unchanged
    expect(processed).toBe(0)
    expect(checker).not.toHaveBeenCalled()

    const rows = await db.query.runs.findMany({ where: (r, { eq }) => eq(r.id, runId) })
    expect(rows[0]!.status).toBe('running')
  })

  it('AC-05-04: stale run + pod not_found → status=failed, failureClass=sandbox_died', async () => {
    // Arrange
    const { tenantId, runId } = await seedDb(db)
    await setRunStatus(db, runId, 'running')
    await makeStale(db, runId)

    const checker: PodChecker = vi.fn().mockResolvedValue({ status: 'not_found' })

    // Act
    const processed = await reconcileSweep(db, checker)

    // Assert
    expect(processed).toBe(1)
    expect(checker).toHaveBeenCalledWith(tenantId, runId)

    const rows = await db.query.runs.findMany({ where: (r, { eq }) => eq(r.id, runId) })
    expect(rows[0]!.status).toBe('failed')
    expect(rows[0]!.failureClass).toBe('sandbox_died')
    expect(rows[0]!.finishedAt).toBeInstanceOf(Date)
  })

  it('AC-05-04: stale run + pod pending > 15min → status=failed, failureClass=sandbox_timeout', async () => {
    // Arrange
    const { runId } = await seedDb(db)
    await setRunStatus(db, runId, 'scheduling')
    await makeStale(db, runId)

    const SIXTEEN_MINUTES_MS = 16 * 60 * 1000
    const checker: PodChecker = vi
      .fn()
      .mockResolvedValue({ status: 'pending', ageMs: SIXTEEN_MINUTES_MS })

    // Act
    const processed = await reconcileSweep(db, checker)

    // Assert
    expect(processed).toBe(1)

    const rows = await db.query.runs.findMany({ where: (r, { eq }) => eq(r.id, runId) })
    expect(rows[0]!.status).toBe('failed')
    expect(rows[0]!.failureClass).toBe('sandbox_timeout')
    expect(rows[0]!.finishedAt).toBeInstanceOf(Date)
  })

  it('AC-05-04: stale run + pod running → skip, status unchanged (pod still alive)', async () => {
    // Arrange
    const { runId } = await seedDb(db)
    await setRunStatus(db, runId, 'running')
    await makeStale(db, runId)

    const checker: PodChecker = vi.fn().mockResolvedValue({ status: 'running' })

    // Act
    const processed = await reconcileSweep(db, checker)

    // Assert — checker was called but pod is alive, so no failure recorded
    expect(processed).toBe(0)
    expect(checker).toHaveBeenCalled()

    const rows = await db.query.runs.findMany({ where: (r, { eq }) => eq(r.id, runId) })
    expect(rows[0]!.status).toBe('running')
    expect(rows[0]!.finishedAt).toBeNull()
  })

  it('AC-05-04: stale run + pod failed → status=failed, failureClass=sandbox_died, failureMessage forwarded', async () => {
    // Arrange
    const { tenantId, runId } = await seedDb(db)
    await setRunStatus(db, runId, 'running')
    await makeStale(db, runId)

    const checker: PodChecker = vi
      .fn()
      .mockResolvedValue({ status: 'failed', message: 'OOMKilled' })

    // Act
    const processed = await reconcileSweep(db, checker)

    // Assert
    expect(processed).toBe(1)
    expect(checker).toHaveBeenCalledWith(tenantId, runId)

    const rows = await db.query.runs.findMany({ where: (r, { eq }) => eq(r.id, runId) })
    expect(rows[0]!.status).toBe('failed')
    expect(rows[0]!.failureClass).toBe('sandbox_died')
    expect(rows[0]!.failureMessage).toBe('OOMKilled')
    expect(rows[0]!.finishedAt).toBeInstanceOf(Date)
  })
})
