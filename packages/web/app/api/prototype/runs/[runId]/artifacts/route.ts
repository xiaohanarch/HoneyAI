import { NextResponse } from 'next/server'
import { eq, asc } from 'drizzle-orm'
import { getDb } from '@honeyai/db'
import { artifacts, runs } from '@honeyai/db/schema'
import { auth } from '@/lib/auth'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
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
    .select({ tenantId: runs.tenantId })
    .from(runs)
    .where(eq(runs.id, runId))
    .limit(1)

  if (!runRows[0] || runRows[0].tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const artifactRows = await db
    .select({
      id: artifacts.id,
      kind: artifacts.kind,
      status: artifacts.status,
      blobSha256: artifacts.blobSha256,
      nodeId: artifacts.nodeId,
      attempt: artifacts.attempt,
      metadata: artifacts.metadata,
      createdAt: artifacts.createdAt,
    })
    .from(artifacts)
    .where(eq(artifacts.runId, runId))
    .orderBy(asc(artifacts.createdAt))

  return NextResponse.json({ artifacts: artifactRows })
}
