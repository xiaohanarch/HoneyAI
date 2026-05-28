import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@honeyai/db'
import { runs } from '@honeyai/db/schema'
import { resumeFromGate } from '@honeyai/orchestrator'
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

  let body: { nodeId?: string; reason?: string }
  try {
    body = (await req.json()) as { nodeId?: string; reason?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const nodeId = body.nodeId
  if (!nodeId || !UUID_RE.test(nodeId)) {
    return NextResponse.json({ error: 'Invalid nodeId' }, { status: 400 })
  }

  const db = getDb()
  const runRows = await db.select({ tenantId: runs.tenantId }).from(runs).where(eq(runs.id, runId))
  if (!runRows[0] || runRows[0].tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    await resumeFromGate(db, runId, nodeId, session.user.id, 'reject')
  } catch {
    return NextResponse.json({ error: 'REJECT_FAILED' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
