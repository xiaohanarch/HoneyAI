import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { Queue } from 'bullmq'
import { getDb } from '@honeyai/db'
import { runs, nodes } from '@honeyai/db/schema'
import { viewGate, passGate } from '@honeyai/orchestrator'
import { ADVANCE_RUN_QUEUE } from '@honeyai/worker'
import { auth } from '@/lib/auth'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { runId } = await params
  if (!UUID_RE.test(runId)) {
    return NextResponse.json({ error: 'Invalid runId' }, { status: 400 })
  }

  let body: { nodeId?: string }
  try {
    body = (await req.json()) as { nodeId?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const nodeId = body.nodeId
  if (!nodeId || !UUID_RE.test(nodeId)) {
    return NextResponse.json({ error: 'Invalid nodeId' }, { status: 400 })
  }

  // Verify run belongs to this tenant
  const db = getDb()
  const runRows = await db.select({ tenantId: runs.tenantId }).from(runs).where(eq(runs.id, runId))
  if (!runRows[0] || runRows[0].tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await viewGate(db, nodeId)
  const result = await passGate(db, nodeId, session.user.id)
  if (!result.ok) {
    return NextResponse.json({ error: 'GATE_NOT_VIEWED' }, { status: 400 })
  }

  // pg_notify so the client store updates immediately
  const gateNodeRows = await db
    .select({ id: nodes.id, name: nodes.name, kind: nodes.kind, stage: nodes.stage })
    .from(nodes)
    .where(eq(nodes.id, nodeId))
  const gateNode = gateNodeRows[0]
  if (gateNode) {
    const payload = JSON.stringify({
      type: 'node_status',
      nodeId: gateNode.id,
      nodeName: gateNode.name,
      nodeKind: gateNode.kind,
      nodeStage: gateNode.stage,
      status: 'success',
      ts: Date.now(),
    })
    await db.execute(sql`SELECT pg_notify(${'run:' + runId}, ${payload})`)
  }

  const redisUrl = process.env['REDIS_URL']
  if (!redisUrl) {
    return NextResponse.json({ error: 'REDIS_NOT_CONFIGURED' }, { status: 500 })
  }

  const queue = new Queue(ADVANCE_RUN_QUEUE, { connection: { url: redisUrl } })
  try {
    await queue.add('advanceRun', {
      runId,
      tenantId: session.user.tenantId,
      completedNodeId: nodeId,
    })
  } finally {
    await queue.close()
  }

  return NextResponse.json({ ok: true })
}
