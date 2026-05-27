import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { eq, gt, and } from 'drizzle-orm'
import { getDb } from '@honeyai/db'
import { events, runs } from '@honeyai/db/schema'
import { auth } from '@/lib/auth'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
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

  const { searchParams } = new URL(req.url)
  const nodeId = searchParams.get('nodeId') ?? undefined
  const afterStr = searchParams.get('after') ?? '0'
  const after = BigInt(afterStr)

  if (nodeId !== undefined && !UUID_RE.test(nodeId)) {
    return NextResponse.json({ error: 'Invalid nodeId' }, { status: 400 })
  }

  const db = getDb()
  const runRows = await db
    .select({ tenantId: runs.tenantId })
    .from(runs)
    .where(eq(runs.id, runId))
    .limit(1)

  if (!runRows[0] || runRows[0].tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const baseCondition = and(eq(events.runId, runId), gt(events.seq, after))
  const condition = nodeId !== undefined ? and(baseCondition, eq(events.nodeId, nodeId)) : baseCondition

  const eventRows = await db
    .select({
      id: events.id,
      seq: events.seq,
      kind: events.kind,
      payload: events.payload,
      occurredAt: events.occurredAt,
    })
    .from(events)
    .where(condition)
    .orderBy(events.seq)
    .limit(100)

  return NextResponse.json({
    events: eventRows.map((e) => ({ ...e, seq: e.seq.toString() })),
  })
}
