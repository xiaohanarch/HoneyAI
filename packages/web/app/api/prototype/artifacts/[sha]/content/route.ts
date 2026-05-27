import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getDb } from '@honeyai/db'
import { artifacts, events, runs } from '@honeyai/db/schema'
import { auth } from '@/lib/auth'

const SHA256_RE = /^[0-9a-f]{64}$/

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sha: string }> },
) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { sha } = await params
  if (!SHA256_RE.test(sha)) {
    return NextResponse.json({ error: 'Invalid sha' }, { status: 400 })
  }

  const db = getDb()

  // Find artifact by sha256, verify tenant ownership
  const artifactRows = await db
    .select({
      id: artifacts.id,
      nodeId: artifacts.nodeId,
      runId: artifacts.runId,
      kind: artifacts.kind,
      tenantId: artifacts.tenantId,
    })
    .from(artifacts)
    .where(eq(artifacts.blobSha256, sha))
    .limit(1)

  const artifact = artifactRows[0]
  if (!artifact || artifact.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let content: string

  if (!artifact.nodeId) {
    // User-submitted artifact — content is the run's oneLiner
    const runRows = await db
      .select({ oneLiner: runs.oneLiner })
      .from(runs)
      .where(eq(runs.id, artifact.runId))
      .limit(1)
    content = runRows[0]?.oneLiner ?? ''
  } else {
    // Agent-produced artifact — reconstruct from text events
    const eventRows = await db
      .select({ payload: events.payload })
      .from(events)
      .where(and(eq(events.nodeId, artifact.nodeId), eq(events.kind, 'text')))
      .orderBy(events.seq)

    content = eventRows
      .map((e) => {
        const p = e.payload as Record<string, unknown>
        return typeof p['content'] === 'string' ? p['content'] : ''
      })
      .join('')
  }

  return NextResponse.json({ sha, content })
}
