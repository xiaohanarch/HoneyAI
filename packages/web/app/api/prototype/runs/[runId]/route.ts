import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@honeyai/db'
import { runs, nodes, artifacts, artifactBlobs } from '@honeyai/db/schema'
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
  const [runRows, nodeRows] = await Promise.all([
    db.select().from(runs).where(eq(runs.id, runId)).limit(1),
    db.select().from(nodes).where(eq(nodes.runId, runId)),
  ])

  const run = runRows[0]
  if (!run || run.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Fetch last artifact content for display (design_ir or requirement_ir)
  let lastArtifactContent: string | null = null
  const artifactRows = await db
    .select({ blobSha256: artifacts.blobSha256, kind: artifacts.kind })
    .from(artifacts)
    .where(eq(artifacts.runId, runId))
    .orderBy(artifacts.attempt)

  // Try design_ir first, then requirement_ir
  const preferred = ['design_ir', 'requirement_ir', 'impl_ir']
  for (const kind of preferred) {
    const art = artifactRows.filter((a) => a.kind === kind && !a.blobSha256.startsWith('placeholder')).pop()
    if (art) {
      // We can't read blob content from DB directly (it's in OSS), just include the sha
      lastArtifactContent = art.blobSha256
      break
    }
  }

  return NextResponse.json({
    run: {
      id: run.id,
      title: run.title,
      oneLiner: run.oneLiner,
      status: run.status,
      createdAt: run.createdAt,
    },
    nodes: nodeRows.map((n) => ({
      id: n.id,
      name: n.name,
      kind: n.kind,
      status: n.status,
      stage: n.stage,
      ordinal: n.ordinal,
    })),
    lastArtifactSha: lastArtifactContent,
  })
}
