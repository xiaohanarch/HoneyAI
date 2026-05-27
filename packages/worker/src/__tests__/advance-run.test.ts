import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
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
import {
  tenants,
  users,
  githubInstallations,
  repositories,
  runs,
  nodes,
  artifactBlobs,
  artifacts,
} from '@honeyai/db/schema'
import { pauseRunAtGate } from '@honeyai/orchestrator'
import type { RuntimeAdapter, StreamingNodeEvent } from '../types.js'
import type { AdvanceRunDeps } from '../handlers/advance-run.js'
import { handleAdvanceRun } from '../handlers/advance-run.js'

// ─── types ────────────────────────────────────────────────────────────────────

type TestDb = NodePgDatabase<typeof schema>

// ─── DB connection helper ─────────────────────────────────────────────────────

async function createDb(url: string): Promise<{ db: TestDb; end: () => Promise<void> }> {
  const client = new Client({ connectionString: url })
  await client.connect()
  const db = drizzle(client, { schema })
  return { db, end: () => client.end() }
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

// ─── seed helpers ──────────────────────────────────────────────────────────────

let _seq = 0
const nextSeq = () => ++_seq

/**
 * setupRunWithArtifact — seeds a paused run at a gate with an existing artifact.
 *
 * @param db         drizzle instance
 * @param stage      The gate node's stage number (1 = stage1.gate, 2 = stage2.gate)
 * @param artifactKind  The kind of artifact produced by the previous agent
 * @param artifactContent  The content text for the artifact blob
 */
async function setupRunWithArtifact(
  db: TestDb,
  stage: 1 | 2,
  artifactKind: 'requirement_ir' | 'design_ir',
  artifactContent: string,
): Promise<{
  runId: string
  tenantId: string
  gateNodeId: string
  blobSha256: string
  repoId: string
}> {
  const n = nextSeq()
  const tenantId = uuidv7()
  const userId = uuidv7()
  const installationId = uuidv7()
  const repoId = uuidv7()
  const runId = uuidv7()

  await db.insert(tenants).values({ id: tenantId, slug: `t-adv-${n}`, name: `Tenant ${n}` })
  await db.insert(users).values({ id: userId, githubId: 5_000_000 + n, githubLogin: `u-adv-${n}` })
  await db.insert(githubInstallations).values({
    id: installationId,
    installationId: 9_000_000 + n,
    accountLogin: `acme-adv-${n}`,
    accountType: 'Organization',
  })
  await db.insert(repositories).values({
    id: repoId,
    tenantId,
    installationId,
    githubRepoId: 7_000_000 + n,
    owner: 'acme',
    name: `repo-adv-${n}`,
    defaultBranch: 'main',
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

  // Insert completed agent node for the stage
  const agentNodeId = uuidv7()
  await db.insert(nodes).values({
    id: agentNodeId,
    runId,
    stage,
    ordinal: 1,
    name: stage === 1 ? 'enrich' : 'design',
    kind: 'agent',
    status: 'success',
    retryCount: 0,
    config: {},
  })

  // Insert gate node for the stage
  const gateNodeId = uuidv7()
  await db.insert(nodes).values({
    id: gateNodeId,
    runId,
    stage,
    ordinal: 2,
    name: `stage${stage}.gate`,
    kind: 'gate',
    status: 'pending',
    retryCount: 0,
    config: {},
  })

  // Use pauseRunAtGate to set up the gates row and run status
  await pauseRunAtGate(db, runId, gateNodeId)

  // Insert artifact blob for the previous stage output
  const buf = Buffer.from(artifactContent, 'utf-8')
  const blobSha256 = createHash('sha256').update(buf).digest('hex')
  const ossKey = `ir/${tenantId}/${runId}/${agentNodeId}/${artifactKind}.md`

  await db.insert(artifactBlobs).values({
    sha256: blobSha256,
    byteSize: BigInt(buf.length),
    ossKey,
    contentType: 'text/markdown',
  })

  await db.insert(artifacts).values({
    id: uuidv7(),
    tenantId,
    runId,
    nodeId: agentNodeId,
    attempt: 1,
    kind: artifactKind,
    status: 'ok',
    blobSha256,
    metadata: {},
    authorKind: 'agent',
    pinned: false,
  })

  return { runId, tenantId, gateNodeId, blobSha256, repoId }
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

// ─── handleAdvanceRun tests ───────────────────────────────────────────────────

describe('handleAdvanceRun', () => {
  it('AC-02-03: advanceRun stage1→design — design node runs, DesignIR artifact inserted, stage2 gate opened', async () => {
    // Arrange
    const requirementIrContent = '# Requirement IR\nAs a user I want to login with GitHub OAuth'
    const { runId, tenantId, gateNodeId } = await setupRunWithArtifact(
      db,
      1,
      'requirement_ir',
      requirementIrContent,
    )

    const designIrContent = '# Design IR\nSystem components: AuthService, UserRepo'
    const adapter = makeAdapter([
      { kind: 'thinking', ts: new Date().toISOString(), content: 'thinking about design...' },
      { kind: 'text', ts: new Date().toISOString(), content: designIrContent },
      { kind: 'finish', ts: new Date().toISOString(), reason: 'end_turn' },
    ])

    const createPRMock = vi.fn()

    const deps: AdvanceRunDeps = {
      db,
      adapter,
      anthropicKey: 'sk-test-fake',
      createPR: createPRMock,
      getArtifactContent: async (_sha256: string) => requirementIrContent,
    }

    // Act
    await handleAdvanceRun(deps, { runId, tenantId, completedNodeId: gateNodeId })

    // Assert — run status: still paused_at_gate (waiting for stage2 gate)
    const allRuns = await db.query.runs.findMany({ where: (r, { eq }) => eq(r.id, runId) })
    expect(allRuns[0]!.status).toBe('paused_at_gate')

    // Assert — nodes: design agent (stage=2, ordinal=1) + stage2 gate (stage=2, ordinal=2)
    const allNodes = await db.query.nodes.findMany({
      where: (n, { eq }) => eq(n.runId, runId),
      orderBy: (n, { asc }) => [asc(n.createdAt)],
    })
    // There are 2 original nodes (stage1 agent + stage1 gate) + 2 new nodes = 4 total
    expect(allNodes).toHaveLength(4)

    // Find the new design agent node
    const designNode = allNodes.find((n) => n.stage === 2 && n.kind === 'agent')
    expect(designNode).toBeDefined()
    expect(designNode!.ordinal).toBe(1)
    expect(designNode!.name).toBe('design')
    expect(designNode!.status).toBe('success')

    // Find the new stage2 gate node
    const stage2GateNode = allNodes.find((n) => n.stage === 2 && n.kind === 'gate')
    expect(stage2GateNode).toBeDefined()
    expect(stage2GateNode!.ordinal).toBe(2)
    expect(stage2GateNode!.name).toBe('stage2.gate')
    expect(stage2GateNode!.status).toBe('pending')

    // Assert — events inserted for design stage (thinking + text + finish)
    const eventRows = await db.query.events.findMany({
      where: (e, { eq }) => eq(e.nodeId, designNode!.id),
      orderBy: (e, { asc }) => [asc(e.seq)],
    })
    expect(eventRows).toHaveLength(3)
    expect(eventRows[0]!.kind).toBe('thinking')
    expect(eventRows[1]!.kind).toBe('text')
    expect(eventRows[2]!.kind).toBe('finish')

    // Assert — design_ir artifact inserted
    const buf = Buffer.from(designIrContent, 'utf-8')
    const expectedSha256 = createHash('sha256').update(buf).digest('hex')
    const artifactRows = await db.query.artifacts.findMany({
      where: (a, { and, eq }) => and(eq(a.runId, runId), eq(a.kind, 'design_ir')),
    })
    expect(artifactRows).toHaveLength(1)
    expect(artifactRows[0]!.kind).toBe('design_ir')
    expect(artifactRows[0]!.status).toBe('ok')
    expect(artifactRows[0]!.blobSha256).toBe(expectedSha256)

    // Assert — blob inserted
    const blobRows = await db.query.artifactBlobs.findMany({
      where: (b, { eq }) => eq(b.sha256, expectedSha256),
    })
    expect(blobRows).toHaveLength(1)

    // Assert — stage2 gate row in gates table
    const gateRows = await db.query.gates.findMany({
      where: (g, { eq }) => eq(g.nodeId, stage2GateNode!.id),
    })
    expect(gateRows).toHaveLength(1)
    expect(gateRows[0]!.openedAt).toBeInstanceOf(Date)

    // Assert — createPR NOT called
    expect(createPRMock).not.toHaveBeenCalled()
  }, 60_000)

  it('AC-02-04: advanceRun stage2→implement — implement node runs, ImplIR artifact inserted, createPR called, run completed', async () => {
    // Arrange — set up run with stage1 artifacts and stage2 gate passed
    const requirementIrContent = '# Requirement IR\nAs a user I want to login'
    const designIrContent = '# Design IR\nAuthService handles OAuth flow'

    // First seed a run with stage2 gate (meaning stage2 gate was passed)
    const n = nextSeq()
    const tenantId = uuidv7()
    const userId = uuidv7()
    const installationId = uuidv7()
    const repoId = uuidv7()
    const runId = uuidv7()

    await db.insert(tenants).values({ id: tenantId, slug: `t-adv2-${n}`, name: `Tenant ${n}` })
    await db.insert(users).values({
      id: userId,
      githubId: 5_500_000 + n,
      githubLogin: `u-adv2-${n}`,
    })
    await db.insert(githubInstallations).values({
      id: installationId,
      installationId: 9_500_000 + n,
      accountLogin: `acme-adv2-${n}`,
      accountType: 'Organization',
    })
    await db.insert(repositories).values({
      id: repoId,
      tenantId,
      installationId,
      githubRepoId: 7_500_000 + n,
      owner: 'acme',
      name: `repo-adv2-${n}`,
      defaultBranch: 'main',
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

    // stage1: enrich node + stage1 gate
    const enrichNodeId = uuidv7()
    await db.insert(nodes).values({
      id: enrichNodeId,
      runId,
      stage: 1,
      ordinal: 1,
      name: 'enrich',
      kind: 'agent',
      status: 'success',
      retryCount: 0,
      config: {},
    })
    const stage1GateId = uuidv7()
    await db.insert(nodes).values({
      id: stage1GateId,
      runId,
      stage: 1,
      ordinal: 2,
      name: 'stage1.gate',
      kind: 'gate',
      status: 'pending',
      retryCount: 0,
      config: {},
    })
    // Insert requirement_ir artifact
    const reqBuf = Buffer.from(requirementIrContent, 'utf-8')
    const reqSha256 = createHash('sha256').update(reqBuf).digest('hex')
    await db.insert(artifactBlobs).values({
      sha256: reqSha256,
      byteSize: BigInt(reqBuf.length),
      ossKey: `ir/${tenantId}/${runId}/${enrichNodeId}/requirement_ir.md`,
      contentType: 'text/markdown',
    })
    await db.insert(artifacts).values({
      id: uuidv7(),
      tenantId,
      runId,
      nodeId: enrichNodeId,
      attempt: 1,
      kind: 'requirement_ir',
      status: 'ok',
      blobSha256: reqSha256,
      metadata: {},
      authorKind: 'agent',
      pinned: false,
    })

    // stage2: design node + stage2 gate
    const designNodeId = uuidv7()
    await db.insert(nodes).values({
      id: designNodeId,
      runId,
      stage: 2,
      ordinal: 1,
      name: 'design',
      kind: 'agent',
      status: 'success',
      retryCount: 0,
      config: {},
    })
    const stage2GateId = uuidv7()
    await db.insert(nodes).values({
      id: stage2GateId,
      runId,
      stage: 2,
      ordinal: 2,
      name: 'stage2.gate',
      kind: 'gate',
      status: 'pending',
      retryCount: 0,
      config: {},
    })
    // Insert design_ir artifact
    const desBuf = Buffer.from(designIrContent, 'utf-8')
    const desSha256 = createHash('sha256').update(desBuf).digest('hex')
    await db.insert(artifactBlobs).values({
      sha256: desSha256,
      byteSize: BigInt(desBuf.length),
      ossKey: `ir/${tenantId}/${runId}/${designNodeId}/design_ir.md`,
      contentType: 'text/markdown',
    })
    await db.insert(artifacts).values({
      id: uuidv7(),
      tenantId,
      runId,
      nodeId: designNodeId,
      attempt: 1,
      kind: 'design_ir',
      status: 'ok',
      blobSha256: desSha256,
      metadata: {},
      authorKind: 'agent',
      pinned: false,
    })

    // pause at stage2 gate
    await pauseRunAtGate(db, runId, stage2GateId)

    // Mock adapter — text event carries IR content; finish has no content
    const implIrContent = '# Impl IR\nFiles: src/auth/service.ts'
    const adapter = makeAdapter([
      { kind: 'text', ts: new Date().toISOString(), content: implIrContent },
      { kind: 'finish', ts: new Date().toISOString(), reason: 'end_turn' },
    ])

    const createPRMock = vi.fn().mockResolvedValue({
      prNumber: 42,
      prUrl: `https://github.com/acme/repo-adv2-${n}/pull/42`,
      branchName: `honeyai/run-${runId}`,
      sha: 'abc123def456',
    })

    const deps: AdvanceRunDeps = {
      db,
      adapter,
      anthropicKey: 'sk-test-fake',
      createPR: createPRMock,
      getArtifactContent: async (sha256: string) => {
        if (sha256 === desSha256) return designIrContent
        if (sha256 === reqSha256) return requirementIrContent
        throw new Error(`Unknown sha256: ${sha256}`)
      },
    }

    // Act
    await handleAdvanceRun(deps, { runId, tenantId, completedNodeId: stage2GateId })

    // Assert — run status: completed
    const allRuns = await db.query.runs.findMany({ where: (r, { eq }) => eq(r.id, runId) })
    expect(allRuns[0]!.status).toBe('completed')

    // Assert — implement agent node inserted (stage=3, status='success')
    const allNodes = await db.query.nodes.findMany({
      where: (n, { eq }) => eq(n.runId, runId),
      orderBy: (n, { asc }) => [asc(n.createdAt)],
    })
    const implNode = allNodes.find((nd) => nd.stage === 3 && nd.kind === 'agent')
    expect(implNode).toBeDefined()
    expect(implNode!.name).toBe('implement')
    expect(implNode!.status).toBe('success')

    // Assert — impl_ir artifact inserted
    const implBuf = Buffer.from(implIrContent, 'utf-8')
    const implSha256 = createHash('sha256').update(implBuf).digest('hex')
    const artifactRows = await db.query.artifacts.findMany({
      where: (a, { and, eq }) => and(eq(a.runId, runId), eq(a.kind, 'impl_ir')),
    })
    expect(artifactRows).toHaveLength(1)
    expect(artifactRows[0]!.kind).toBe('impl_ir')
    expect(artifactRows[0]!.status).toBe('ok')
    expect(artifactRows[0]!.blobSha256).toBe(implSha256)

    // Assert — createPR called once
    expect(createPRMock).toHaveBeenCalledTimes(1)
    const callArgs = createPRMock.mock.calls[0]![0] as {
      owner: string
      repo: string
      baseBranch: string
      headBranch: string
      title: string
      runId: string
    }
    expect(callArgs.owner).toBe('acme')
    expect(callArgs.repo).toBe(`repo-adv2-${n}`)
    expect(callArgs.baseBranch).toBe('main')
    expect(callArgs.headBranch).toBe(`honeyai/run-${runId}`)
    expect(callArgs.title).toBe(`Run ${n}`)
    expect(callArgs.runId).toBe(runId)
  }, 60_000)
})
