import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@honeyai/db'
import { artifactBlobs } from '@honeyai/db/schema'
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
  const blobRows = await db
    .select({
      sha256: artifactBlobs.sha256,
      ossKey: artifactBlobs.ossKey,
    })
    .from(artifactBlobs)
    .where(eq(artifactBlobs.sha256, sha))
    .limit(1)

  const blob = blobRows[0]
  if (!blob) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    sha: blob.sha256,
    ossKey: blob.ossKey,
    content: '(artifact content from ' + blob.ossKey + ')',
  })
}
