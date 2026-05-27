import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { v7 as uuidv7 } from 'uuid'
import { createHash } from 'node:crypto'
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
import { tenants, users, githubInstallations, repositories, runs } from '@honeyai/db/schema'
import type { RuntimeAdapter, StreamingNodeEvent } from '../types.js'
import { handleScheduleRun } from '../handlers/schedule-run.js'

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

async function seedRun(db: TestDb): Promise<{
  tenantId: string
  runId: string
  userId: string
  repoId: string
}> {
  const n = nextSeq()
  const tenantId = uuidv7()
  const userId = uuidv7()
  const installationId = uuidv7()
  const repoId = uuidv7()
  const runId = uuidv7()

  await db.insert(tenants).values({ id: tenantId, slug: `t-sched-${n}`, name: `Tenant ${n}` })
  await db
    .insert(users)
    .values({ id: userId, githubId: 4_000_000 + n, githubLogin: `u-sched-${n}` })
  await db.insert(githubInstallations).values({
    id: installationId,
    installationId: 8_000_000 + n,
    accountLogin: `acme-sched-${n}`,
    accountType: 'Organization',
  })
  await db.insert(repositories).values({
    id: repoId,
    tenantId,
    installationId,
    githubRepoId: 6_000_000 + n,
    owner: 'acme',
    name: `repo-sched-${n}`,
  })
  await db.insert(runs).values({
    id: runId,
    tenantId,
    repositoryId: repoId,
    createdByUserId: userId,
    title: `Run ${n}`,
    oneLiner: '# Requirement IR\nAs a user I want to login',
    status: 'created',
  })

  return { tenantId, runId, userId, repoId }
}

// ─── mock adapter factory ─────────────────────────────────────────────────────

function makeAdapter(events: StreamingNodeEvent[]): RuntimeAdapter {
  return {
    async *executeNode() {
      for (const e of events) {
        yield e
      }
    },
  }
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

// ─── handleScheduleRun tests ──────────────────────────────────────────────────

describe('handleScheduleRun', () => {
  it('AC-02-01: scheduleRun happy path — enrich node runs, artifact inserted, gate opened', async () => {
    // Arrange
    const { tenantId, runId } = await seedRun(db)

    const finishContent = '# Requirement IR\nAs a user I want to login with GitHub OAuth'
    const adapter = makeAdapter([
      { kind: 'thinking', ts: new Date().toISOString(), content: 'thinking...' },
      { kind: 'text', ts: new Date().toISOString(), content: finishContent },
      { kind: 'finish', ts: new Date().toISOString(), reason: 'end_turn' },
    ])

    // Act
    await handleScheduleRun({ db, adapter, anthropicKey: 'sk-test-fake' }, { runId, tenantId })

    // Assert — run status
    const runRows = await db.query.runs.findMany({ where: (r, { eq }) => eq(r.id, runId) })
    expect(runRows[0]!.status).toBe('paused_at_gate')

    // Assert — nodes: 2 total (1 agent + 1 gate)
    const nodeRows = await db.query.nodes.findMany({
      where: (n, { eq }) => eq(n.runId, runId),
      orderBy: (n, { asc }) => [asc(n.ordinal)],
    })
    expect(nodeRows).toHaveLength(2)

    const agentNode = nodeRows[0]!
    expect(agentNode.stage).toBe(1)
    expect(agentNode.ordinal).toBe(1)
    expect(agentNode.kind).toBe('agent')
    expect(agentNode.name).toBe('enrich')
    expect(agentNode.status).toBe('success')

    const gateNode = nodeRows[1]!
    expect(gateNode.stage).toBe(1)
    expect(gateNode.ordinal).toBe(2)
    expect(gateNode.kind).toBe('gate')
    expect(gateNode.name).toBe('stage1.gate')
    expect(gateNode.status).toBe('pending')

    // Assert — events: 3 (thinking + text + finish)
    const eventRows = await db.query.events.findMany({
      where: (e, { eq }) => eq(e.runId, runId),
      orderBy: (e, { asc }) => [asc(e.seq)],
    })
    expect(eventRows).toHaveLength(3)
    expect(eventRows[0]!.kind).toBe('thinking')
    expect(eventRows[1]!.kind).toBe('text')
    expect(eventRows[2]!.kind).toBe('finish')

    // Assert — artifact_blob (sha256 correct)
    const buf = Buffer.from(finishContent, 'utf-8')
    const expectedSha256 = createHash('sha256').update(buf).digest('hex')
    const blobRows = await db.query.artifactBlobs.findMany({
      where: (b, { eq }) => eq(b.sha256, expectedSha256),
    })
    expect(blobRows).toHaveLength(1)
    expect(blobRows[0]!.byteSize).toBe(BigInt(buf.length))

    // Assert — artifact (kind='requirement_ir', status='ok')
    const artifactRows = await db.query.artifacts.findMany({
      where: (a, { eq }) => eq(a.runId, runId),
    })
    expect(artifactRows).toHaveLength(1)
    expect(artifactRows[0]!.kind).toBe('requirement_ir')
    expect(artifactRows[0]!.status).toBe('ok')
    expect(artifactRows[0]!.blobSha256).toBe(expectedSha256)
    expect(artifactRows[0]!.authorKind).toBe('agent')

    // Assert — gates row exists
    const gateRows = await db.query.gates.findMany({
      where: (g, { eq }) => eq(g.nodeId, gateNode.id),
    })
    expect(gateRows).toHaveLength(1)
    expect(gateRows[0]!.openedAt).toBeInstanceOf(Date)
  }, 60_000)

  it('AC-02-02: scheduleRun — pg_notify gate_opened delivered via LISTEN', async () => {
    // Arrange
    const { tenantId, runId } = await seedRun(db)

    const finishContent = '# Requirement IR\nnotify test'
    const adapter = makeAdapter([
      { kind: 'text', ts: new Date().toISOString(), content: finishContent },
      { kind: 'finish', ts: new Date().toISOString(), reason: 'end_turn' },
    ])

    // Set up LISTEN on the run channel using a raw PG client
    const listenUrl = testDatabaseUrl(handle, dbName)
    const listenClient = new Client({ connectionString: listenUrl })
    await listenClient.connect()

    const received: Array<{ channel: string; payload: string }> = []
    listenClient.on('notification', (msg) => {
      received.push({ channel: msg.channel, payload: msg.payload ?? '' })
    })
    await listenClient.query(`LISTEN "run:${runId}"`)

    // Act
    await handleScheduleRun({ db, adapter, anthropicKey: 'sk-test-fake' }, { runId, tenantId })

    // Give PG a moment to deliver the notification
    await new Promise<void>((resolve) => setTimeout(resolve, 200))

    // Assert — at least one gate_opened notification received
    const gateNotifs = received.filter((n) => {
      try {
        const parsed = JSON.parse(n.payload) as { type?: string }
        return parsed.type === 'gate_opened'
      } catch {
        return false
      }
    })
    expect(gateNotifs.length).toBeGreaterThanOrEqual(1)

    await listenClient.end()
  }, 60_000)
})
