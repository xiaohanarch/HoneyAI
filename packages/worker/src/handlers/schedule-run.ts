// handleScheduleRun — Spec §7.1 sequence:
// 1. UPDATE runs SET status='running'
// 2. INSERT enrich agent node (stage=1, ordinal=1, status='running')
// 3. pg_notify 'run:<runId>' { type: 'run_status', status: 'running' }
// 4. adapter.executeNode({ kind='enrich', ... })
// 5. For each NodeEvent: INSERT events + pg_notify node_event
// 6. On 'finish': compute sha256, INSERT artifact_blobs + artifacts, UPDATE node status='success'
// 7. INSERT gate node (stage=1, ordinal=2, kind='gate', status='pending')
// 8. pauseRunAtGate(db, runId, gateNodeId)
// 9. pg_notify 'run:<runId>' { type: 'gate_opened', nodeId: gateNodeId }

import { createHash } from 'node:crypto'
import { v7 as uuidv7 } from 'uuid'
import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '@honeyai/db/schema'
import { persistRun, persistNode, pauseRunAtGate } from '@honeyai/orchestrator'
import type { RuntimeAdapter, StreamingNodeEvent } from '../types.js'
import type { ScheduleRunJob } from '../queues.js'
import { pgNotify } from '../notify.js'
import { handleFailure } from './failure.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = NodePgDatabase<any>

export type ScheduleRunDeps = {
  db: AnyDb
  adapter: RuntimeAdapter
  anthropicKey: string
}

export async function handleScheduleRun(deps: ScheduleRunDeps, job: ScheduleRunJob): Promise<void> {
  const { db, adapter, anthropicKey } = deps
  const { runId, tenantId } = job

  // 1. Read the run to get oneLiner
  // Use select() instead of db.query.* to avoid the schema-generic constraint on AnyDb
  const runRows = await db.select().from(schema.runs).where(eq(schema.runs.id, runId))
  const run = runRows[0]
  if (!run) throw new Error(`handleScheduleRun: run not found: ${runId}`)
  const irInput = typeof run.oneLiner === 'string' ? run.oneLiner : String(run.oneLiner ?? '')

  // 2. UPDATE runs SET status='running'
  await persistRun(db, runId, { id: runId, status: 'running' })

  // 3. INSERT enrich agent node (status='running')
  const nodeId = uuidv7()
  await db.insert(schema.nodes).values({
    id: nodeId,
    runId,
    stage: 1,
    ordinal: 1,
    name: 'enrich',
    kind: 'agent',
    status: 'running',
    retryCount: 0,
    config: {},
  })

  // 4. pg_notify run_status=running
  await pgNotify(db, `run:${runId}`, { type: 'run_status', status: 'running' })

  // 5. adapter.executeNode — stream events
  const generator = adapter.executeNode({
    tenantId,
    runId,
    nodeId,
    kind: 'enrich',
    anthropicKey,
    irInput,
  })

  let seq = 0n
  const allEvents: StreamingNodeEvent[] = []

  try {
    for await (const event of generator) {
      allEvents.push(event)

      // Build payload from all real StreamingNodeEvent fields
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

      // INSERT event row
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

  console.log('[schedule-run] generator done, allEvents count=%d', allEvents.length)

  // 6. On finish: INSERT artifact_blobs + artifacts, UPDATE node status='success'
  // IR content comes from the last 'text' event (finish event has no content field)
  const textEvents = allEvents.filter((e) => e.kind === 'text' && e.content !== undefined)
  const irContent = textEvents.length > 0 ? textEvents[textEvents.length - 1]!.content! : undefined
  if (irContent !== undefined) {
    const buf = Buffer.from(irContent, 'utf-8')
    const sha256 = createHash('sha256').update(buf).digest('hex')
    const ossKey = `ir/${tenantId}/${runId}/${nodeId}/requirement_ir.md`

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
      kind: 'requirement_ir',
      status: 'ok',
      blobSha256: sha256,
      metadata: {},
      authorKind: 'agent',
      pinned: false,
    })
  }

  console.log('[schedule-run] irContent found=%s, persisting node success', irContent !== undefined)
  // UPDATE enrich node status='success'
  await persistNode(db, nodeId, {
    id: nodeId,
    kind: 'agent',
    status: 'success',
    retryCount: 0,
  })
  await pgNotify(db, `run:${runId}`, {
    type: 'node_status',
    nodeId,
    nodeName: 'enrich',
    nodeKind: 'agent',
    nodeStage: 1,
    status: 'success',
    ts: Date.now(),
  })

  // 7. INSERT gate node (stage=1, ordinal=2, kind='gate', status='pending')
  const gateNodeId = uuidv7()
  await db.insert(schema.nodes).values({
    id: gateNodeId,
    runId,
    stage: 1,
    ordinal: 2,
    name: 'stage1.gate',
    kind: 'gate',
    status: 'pending',
    retryCount: 0,
    config: {},
  })

  // 8. pauseRunAtGate — INSERT gates row + UPDATE run status='paused_at_gate'
  await pauseRunAtGate(db, runId, gateNodeId)

  // 9. pg_notify node_status for gate + run_status paused_at_gate
  await pgNotify(db, `run:${runId}`, {
    type: 'node_status',
    nodeId: gateNodeId,
    nodeName: 'stage1.gate',
    nodeKind: 'gate',
    nodeStage: 1,
    status: 'pending',
    ts: Date.now(),
  })
  await pgNotify(db, `run:${runId}`, {
    type: 'run_status',
    status: 'paused_at_gate',
    ts: Date.now(),
  })
  console.log('[schedule-run] gate created and notified, gateNodeId=%s', gateNodeId)
}
