import { NextResponse } from 'next/server'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { getDb } from '@honeyai/db'
import { runs, nodes } from '@honeyai/db/schema'
import { auth } from '@/lib/auth'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const CANCELLABLE_STATUSES = ['running', 'paused_at_gate'] as const

export async function POST(
  _req: Request,
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

  const db = getDb()
  const runRows = await db
    .select({ tenantId: runs.tenantId, status: runs.status })
    .from(runs)
    .where(eq(runs.id, runId))
    .limit(1)

  const run = runRows[0]
  if (!run || run.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!CANCELLABLE_STATUSES.includes(run.status as (typeof CANCELLABLE_STATUSES)[number])) {
    return NextResponse.json({ error: 'CANNOT_CANCEL' }, { status: 400 })
  }

  await db.transaction(async (tx) => {
    await tx.update(runs).set({ status: 'cancelled' }).where(eq(runs.id, runId))
    await tx
      .update(nodes)
      .set({ status: 'failed' })
      .where(and(eq(nodes.runId, runId), inArray(nodes.status, ['running'])))
  })

  const payload = JSON.stringify({ type: 'run_status', status: 'cancelled', ts: Date.now() })
  await db.execute(sql`SELECT pg_notify(${'run:' + runId}, ${payload})`)

  return NextResponse.json({ ok: true })
}
