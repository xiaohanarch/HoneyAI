// handleAdvanceRun — Spec §7.2 sequence:
// Called after a Gate is passed. completedNodeId is the gate node that was just passed.
//
// Logic:
// 1. SELECT stage FROM nodes WHERE id = completedNodeId → get gate's stage number
// 2. If stage = 1 → run design (stage 2)
// 3. If stage = 2 → run implement (stage 3) → createPR + complete run
//
// For design stage:
//   a. INSERT design agent node (stage=2, ordinal=1, status='running')
//   b. adapter.executeNode({ kind='design', irInput=requirement_ir content })
//   c. For each NodeEvent: INSERT events + pg_notify node_event
//   d. On 'finish': sha256, INSERT artifact_blobs + artifacts (kind='design_ir')
//   e. persistNode(status='success')
//   f. INSERT stage2 gate node + pauseRunAtGate
//   g. pg_notify gate_opened
//
// For implement stage:
//   a. INSERT implement agent node (stage=3, ordinal=1, status='running')
//   b. adapter.executeNode({ kind='implement', irInput=design_ir content })
//   c. For each NodeEvent: INSERT events + pg_notify node_event
//   d. On 'finish': sha256, INSERT artifact_blobs + artifacts (kind='impl_ir')
//   e. persistNode(status='success')
//   f. createPR(...)
//   g. persistRun(status='completed')
//   h. pg_notify run_completed

import { createHash } from 'node:crypto'
import { v7 as uuidv7 } from 'uuid'
import { eq, and, desc } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '@honeyai/db/schema'
import { persistRun, persistNode, pauseRunAtGate } from '@honeyai/orchestrator'
import type { RuntimeAdapter, StreamingNodeEvent } from '../types.js'
import type { AdvanceRunJob } from '../queues.js'
import { pgNotify } from '../notify.js'
import { handleFailure } from './failure.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = NodePgDatabase<any>

export type AdvanceRunDeps = {
  db: AnyDb
  adapter: RuntimeAdapter
  anthropicKey: string
  createPR: (params: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    octokit: any
    owner: string
    repo: string
    baseBranch: string
    headBranch: string
    title: string
    files: Array<{ path: string; content: string }>
    runId: string
    stageSummary: string
  }) => Promise<{ prNumber: number; prUrl: string; branchName: string; sha: string }>
  getArtifactContent: (blobSha256: string) => Promise<string>
}

export async function handleAdvanceRun(deps: AdvanceRunDeps, job: AdvanceRunJob): Promise<void> {
  const { db, adapter, anthropicKey, createPR, getArtifactContent } = deps
  const { runId, tenantId, completedNodeId } = job

  if (!completedNodeId) {
    throw new Error(`handleAdvanceRun: completedNodeId is required (runId=${runId})`)
  }

  // 1. Get the gate node's stage to determine what to run next
  const gateNodeRows = await db
    .select()
    .from(schema.nodes)
    .where(eq(schema.nodes.id, completedNodeId))
  const gateNode = gateNodeRows[0]
  if (!gateNode) {
    throw new Error(`handleAdvanceRun: gate node not found: ${completedNodeId}`)
  }
  const gateStage = gateNode.stage

  // 2. Get the run record (for title, repositoryId, tenantId)
  const runRows = await db.select().from(schema.runs).where(eq(schema.runs.id, runId))
  const run = runRows[0]
  if (!run) {
    throw new Error(`handleAdvanceRun: run not found: ${runId}`)
  }

  if (gateStage === 1) {
    // stage1 gate passed → run design (stage 2)
    await runDesignStage(db, adapter, anthropicKey, getArtifactContent, run, tenantId, runId)
  } else if (gateStage === 2) {
    // stage2 gate passed → run implement (stage 3)
    await runImplementStage(
      db,
      adapter,
      anthropicKey,
      getArtifactContent,
      createPR,
      run,
      tenantId,
      runId,
    )
  } else {
    throw new Error(
      `handleAdvanceRun: unexpected gate stage ${gateStage} for completedNodeId=${completedNodeId}`,
    )
  }
}

// ─── design stage ─────────────────────────────────────────────────────────────

async function runDesignStage(
  db: AnyDb,
  adapter: RuntimeAdapter,
  anthropicKey: string,
  getArtifactContent: (sha256: string) => Promise<string>,
  run: { id: string; tenantId: string; title: string; repositoryId: string },
  tenantId: string,
  runId: string,
): Promise<void> {
  // Fetch irInput: latest requirement_ir artifact for this run
  const reqArtifactRows = await db
    .select()
    .from(schema.artifacts)
    .where(and(eq(schema.artifacts.runId, runId), eq(schema.artifacts.kind, 'requirement_ir')))
    .orderBy(desc(schema.artifacts.attempt))
    .limit(1)
  const reqArtifact = reqArtifactRows[0]
  if (!reqArtifact) {
    throw new Error(`handleAdvanceRun: no requirement_ir artifact found for run ${runId}`)
  }
  const irInput = await getArtifactContent(reqArtifact.blobSha256)

  // If run was paused, notify it's running again
  await pgNotify(db, `run:${runId}`, { type: 'run_status', status: 'running' })

  // INSERT design agent node
  const nodeId = uuidv7()
  await db.insert(schema.nodes).values({
    id: nodeId,
    runId,
    stage: 2,
    ordinal: 1,
    name: 'design',
    kind: 'agent',
    status: 'running',
    retryCount: 0,
    config: {},
  })

  // Stream events from adapter
  const generator = adapter.executeNode({
    tenantId,
    runId,
    nodeId,
    kind: 'design',
    anthropicKey,
    irInput,
  })

  let seq = 0n
  const allEvents: StreamingNodeEvent[] = []

  try {
    for await (const event of generator) {
      allEvents.push(event)

      const payload: Record<string, unknown> = {
        ts: event.ts,
        kind: event.kind,
        ...(event.content !== undefined ? { content: event.content } : {}),
        ...(event.tool !== undefined ? { tool: event.tool } : {}),
        ...(event.args !== undefined ? { args: event.args } : {}),
        ...(event.outputLen !== undefined ? { outputLen: event.outputLen } : {}),
        ...(event.reason !== undefined ? { reason: event.reason } : {}),
        ...(event.inputTokens !== undefined ? { inputTokens: event.inputTokens } : {}),
        ...(event.outputTokens !== undefined ? { outputTokens: event.outputTokens } : {}),
      }

      await db.insert(schema.events).values({
        id: uuidv7(),
        runId,
        nodeId,
        seq,
        kind: event.kind,
        payload,
      })

      seq++
    }
  } catch (err) {
    await handleFailure(db, err, runId, nodeId, 'agent', 0)
    throw err
  }

  // On finish: INSERT artifact_blobs + artifacts (kind='design_ir')
  // IR content comes from the last 'text' event (finish event has no content field)
  const designTextEvents = allEvents.filter((e) => e.kind === 'text' && e.content !== undefined)
  const designIrContent =
    designTextEvents.length > 0
      ? designTextEvents[designTextEvents.length - 1]!.content!
      : undefined
  if (designIrContent !== undefined) {
    const buf = Buffer.from(designIrContent, 'utf-8')
    const sha256 = createHash('sha256').update(buf).digest('hex')
    const ossKey = `ir/${tenantId}/${runId}/${nodeId}/design_ir.md`

    await db
      .insert(schema.artifactBlobs)
      .values({
        sha256,
        byteSize: BigInt(buf.length),
        ossKey,
        contentType: 'text/markdown',
      })
      .onConflictDoNothing()

    await db.insert(schema.artifacts).values({
      id: uuidv7(),
      tenantId: run.tenantId,
      runId,
      nodeId,
      attempt: 1,
      kind: 'design_ir',
      status: 'ok',
      blobSha256: sha256,
      metadata: {},
      authorKind: 'agent',
      pinned: false,
    })
  }

  // UPDATE design node status='success'
  await persistNode(db, nodeId, {
    id: nodeId,
    kind: 'agent',
    status: 'success',
    retryCount: 0,
  })
  await pgNotify(db, `run:${runId}`, {
    type: 'node_status',
    nodeId,
    nodeName: 'design',
    nodeKind: 'agent',
    nodeStage: 2,
    status: 'success',
    ts: Date.now(),
  })

  // INSERT stage2 gate node
  const gateNodeId = uuidv7()
  await db.insert(schema.nodes).values({
    id: gateNodeId,
    runId,
    stage: 2,
    ordinal: 2,
    name: 'stage2.gate',
    kind: 'gate',
    status: 'pending',
    retryCount: 0,
    config: {},
  })

  // pauseRunAtGate — INSERT gates row + UPDATE run status='paused_at_gate'
  await pauseRunAtGate(db, runId, gateNodeId)

  // pg_notify node_status + run_status
  await pgNotify(db, `run:${runId}`, {
    type: 'node_status',
    nodeId: gateNodeId,
    nodeName: 'stage2.gate',
    nodeKind: 'gate',
    nodeStage: 2,
    status: 'pending',
    ts: Date.now(),
  })
  await pgNotify(db, `run:${runId}`, {
    type: 'run_status',
    status: 'paused_at_gate',
    ts: Date.now(),
  })
}

// ─── implement stage ──────────────────────────────────────────────────────────

async function runImplementStage(
  db: AnyDb,
  adapter: RuntimeAdapter,
  anthropicKey: string,
  getArtifactContent: (sha256: string) => Promise<string>,
  createPR: AdvanceRunDeps['createPR'],
  run: { id: string; tenantId: string; title: string; repositoryId: string },
  tenantId: string,
  runId: string,
): Promise<void> {
  // Fetch irInput: latest design_ir artifact for this run
  const desArtifactRows = await db
    .select()
    .from(schema.artifacts)
    .where(and(eq(schema.artifacts.runId, runId), eq(schema.artifacts.kind, 'design_ir')))
    .orderBy(desc(schema.artifacts.attempt))
    .limit(1)
  const desArtifact = desArtifactRows[0]
  if (!desArtifact) {
    throw new Error(`handleAdvanceRun: no design_ir artifact found for run ${runId}`)
  }
  const irInput = await getArtifactContent(desArtifact.blobSha256)

  // Notify running
  await pgNotify(db, `run:${runId}`, { type: 'run_status', status: 'running' })

  // INSERT implement agent node
  const nodeId = uuidv7()
  await db.insert(schema.nodes).values({
    id: nodeId,
    runId,
    stage: 3,
    ordinal: 1,
    name: 'implement',
    kind: 'agent',
    status: 'running',
    retryCount: 0,
    config: {},
  })

  // Stream events from adapter
  const generator = adapter.executeNode({
    tenantId,
    runId,
    nodeId,
    kind: 'implement',
    anthropicKey,
    irInput,
  })

  let seq = 0n
  const allImplEvents: StreamingNodeEvent[] = []

  try {
    for await (const event of generator) {
      allImplEvents.push(event)

      const payload: Record<string, unknown> = {
        ts: event.ts,
        kind: event.kind,
        ...(event.content !== undefined ? { content: event.content } : {}),
        ...(event.tool !== undefined ? { tool: event.tool } : {}),
        ...(event.args !== undefined ? { args: event.args } : {}),
        ...(event.outputLen !== undefined ? { outputLen: event.outputLen } : {}),
        ...(event.reason !== undefined ? { reason: event.reason } : {}),
        ...(event.inputTokens !== undefined ? { inputTokens: event.inputTokens } : {}),
        ...(event.outputTokens !== undefined ? { outputTokens: event.outputTokens } : {}),
      }

      await db.insert(schema.events).values({
        id: uuidv7(),
        runId,
        nodeId,
        seq,
        kind: event.kind,
        payload,
      })

      seq++
    }
  } catch (err) {
    await handleFailure(db, err, runId, nodeId, 'agent', 0)
    throw err
  }

  // On finish: INSERT artifact_blobs + artifacts (kind='impl_ir')
  // IR content comes from the last 'text' event (finish event has no content field)
  const implTextEvents = allImplEvents.filter((e) => e.kind === 'text' && e.content !== undefined)
  const implIrContent =
    implTextEvents.length > 0 ? implTextEvents[implTextEvents.length - 1]!.content! : undefined
  if (implIrContent !== undefined) {
    const buf = Buffer.from(implIrContent, 'utf-8')
    const sha256 = createHash('sha256').update(buf).digest('hex')
    const ossKey = `ir/${tenantId}/${runId}/${nodeId}/impl_ir.md`

    await db
      .insert(schema.artifactBlobs)
      .values({
        sha256,
        byteSize: BigInt(buf.length),
        ossKey,
        contentType: 'text/markdown',
      })
      .onConflictDoNothing()

    await db.insert(schema.artifacts).values({
      id: uuidv7(),
      tenantId: run.tenantId,
      runId,
      nodeId,
      attempt: 1,
      kind: 'impl_ir',
      status: 'ok',
      blobSha256: sha256,
      metadata: {},
      authorKind: 'agent',
      pinned: false,
    })
  }

  // UPDATE implement node status='success'
  await persistNode(db, nodeId, {
    id: nodeId,
    kind: 'agent',
    status: 'success',
    retryCount: 0,
  })

  // Get repository details for createPR
  const repoRows = await db
    .select()
    .from(schema.repositories)
    .where(eq(schema.repositories.id, run.repositoryId))
  const repo = repoRows[0]
  if (!repo) {
    throw new Error(`handleAdvanceRun: repository not found: ${run.repositoryId}`)
  }

  // createPR
  await createPR({
    octokit: {} as never,
    owner: repo.owner,
    repo: repo.name,
    baseBranch: repo.defaultBranch,
    headBranch: `honeyai/run-${runId}`,
    title: run.title,
    files: [],
    runId,
    stageSummary: 'Implementation complete',
  })

  // persistRun status='completed'
  await persistRun(db, runId, { id: runId, status: 'completed' })

  // pg_notify run_completed
  await pgNotify(db, `run:${runId}`, { type: 'run_completed', runId })
}
