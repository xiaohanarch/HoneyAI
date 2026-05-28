import { NextResponse } from 'next/server'
import { eq, and, gte, sql, max } from 'drizzle-orm'
import { Queue } from 'bullmq'
import { v7 as uuidv7 } from 'uuid'
import { getDb } from '@honeyai/db'
import { runs, nodes, events } from '@honeyai/db/schema'
import { auth } from '@/lib/auth'
import { SCHEDULE_RUN_QUEUE } from '@honeyai/worker'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  req: Request,
  { params }: { params: Promise<{ runId: string; nodeId: string }> },
) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { runId, nodeId } = await params
  if (!UUID_RE.test(runId) || !UUID_RE.test(nodeId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  // Parse optional supplemental context from request body
  let userContext = ''
  try {
    const body = await req.json().catch(() => ({}))
    if (typeof body?.context === 'string') {
      userContext = body.context.trim().slice(0, 4000)
    }
  } catch {
    // ignore parse errors — context is optional
  }

  const db = getDb()

  // Verify run belongs to tenant and is not currently running
  const runRows = await db
    .select({ tenantId: runs.tenantId, status: runs.status })
    .from(runs)
    .where(eq(runs.id, runId))
    .limit(1)

  const run = runRows[0]
  if (!run || run.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (run.status === 'running') {
    return NextResponse.json({ error: 'RUN_IS_RUNNING' }, { status: 400 })
  }

  // Get the target node and its ordinal
  const nodeRows = await db
    .select({ id: nodes.id, status: nodes.status, ordinal: nodes.ordinal })
    .from(nodes)
    .where(and(eq(nodes.id, nodeId), eq(nodes.runId, runId)))
    .limit(1)

  const node = nodeRows[0]
  if (!node) {
    return NextResponse.json({ error: 'Node not found' }, { status: 404 })
  }

  if (node.status === 'running') {
    return NextResponse.json({ error: 'NODE_IS_RUNNING' }, { status: 400 })
  }

  const redisUrl = process.env['REDIS_URL']
  if (!redisUrl) {
    return NextResponse.json({ error: 'REDIS_NOT_CONFIGURED' }, { status: 500 })
  }

  // Reset this node and all downstream nodes (ordinal >= this node) back to pending
  await db.transaction(async (tx) => {
    await tx
      .update(nodes)
      .set({ status: 'pending', retryCount: 0, startedAt: null, finishedAt: null })
      .where(and(eq(nodes.runId, runId), gte(nodes.ordinal, node.ordinal)))

    await tx
      .update(runs)
      .set({ status: 'running', finishedAt: null })
      .where(eq(runs.id, runId))
  })

  // If user provided supplemental context, record it as a user_context event
  if (userContext) {
    const seqRows = await db
      .select({ maxSeq: max(events.seq) })
      .from(events)
      .where(eq(events.runId, runId))
    const nextSeq = BigInt((seqRows[0]?.maxSeq ?? BigInt(-1)) as bigint) + BigInt(1)
    await db.insert(events).values({
      id: uuidv7(),
      runId,
      nodeId,
      seq: nextSeq,
      kind: 'user_context',
      payload: { text: userContext, source: 'rerun_supplement' },
    })
  }

  // Notify clients via pg_notify
  const payload = JSON.stringify({ type: 'run_status', status: 'running', ts: Date.now() })
  await db.execute(sql`SELECT pg_notify(${'run:' + runId}, ${payload})`)

  // Re-enqueue for the worker to pick up
  const queue = new Queue(SCHEDULE_RUN_QUEUE, { connection: { url: redisUrl } })
  try {
    await queue.add('scheduleRun', { runId, tenantId: session.user.tenantId })
  } finally {
    await queue.close()
  }

  return NextResponse.json({ ok: true })
}
