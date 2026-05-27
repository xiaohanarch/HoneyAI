import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { v7 as uuidv7 } from 'uuid'
import { Queue } from 'bullmq'
import { getDb } from '@honeyai/db'
import { runs, artifacts, artifactBlobs, tenants } from '@honeyai/db/schema'
import { decryptAnthropicKey } from '@honeyai/core'
import { eq, desc } from 'drizzle-orm'
import { SCHEDULE_RUN_QUEUE } from '@honeyai/worker'
import { auth } from '@/lib/auth'

export async function GET() {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()
  const runRows = await db
    .select()
    .from(runs)
    .where(eq(runs.tenantId, session.user.tenantId))
    .orderBy(desc(runs.createdAt))
    .limit(50)

  return NextResponse.json({ runs: runRows })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { title?: string; oneLiner?: string }
  try {
    body = (await req.json()) as { title?: string; oneLiner?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const title = body.title?.trim()
  const oneLiner = body.oneLiner?.trim()
  if (!title || !oneLiner) {
    return NextResponse.json({ error: 'title and oneLiner are required' }, { status: 400 })
  }

  const db = getDb()
  const tenantRows = await db.select().from(tenants).where(eq(tenants.id, session.user.tenantId))
  const tenant = tenantRows[0]

  if (!tenant?.defaultRepoId) {
    return NextResponse.json({ error: 'NO_DEFAULT_REPO' }, { status: 400 })
  }

  const ciphertext = tenant.settings?.bootstrap?.anthropicKeyCiphertext
  if (!ciphertext) {
    return NextResponse.json({ error: 'NO_ANTHROPIC_KEY' }, { status: 400 })
  }

  let plainKey: string
  try {
    plainKey = decryptAnthropicKey(ciphertext)
  } catch {
    return NextResponse.json({ error: 'NO_ANTHROPIC_KEY' }, { status: 400 })
  }
  if (!plainKey) {
    return NextResponse.json({ error: 'NO_ANTHROPIC_KEY' }, { status: 400 })
  }

  const redisUrl = process.env['REDIS_URL']
  if (!redisUrl) {
    return NextResponse.json({ error: 'REDIS_NOT_CONFIGURED' }, { status: 500 })
  }

  const runId = uuidv7()
  const tenantId = session.user.tenantId
  const sha256 = createHash('sha256').update(oneLiner).digest('hex')
  const byteSize = BigInt(Buffer.from(oneLiner).length)
  const ossKey = `placeholder/${runId}/requirement_ir.md`

  await db.transaction(async (tx) => {
    await tx.insert(runs).values({
      id: runId,
      status: 'created',
      tenantId,
      repositoryId: tenant.defaultRepoId!,
      createdByUserId: session.user.id,
      title,
      oneLiner,
    })
    await tx.insert(artifactBlobs).values({ sha256, byteSize, ossKey }).onConflictDoNothing()
    await tx.insert(artifacts).values({
      id: uuidv7(),
      tenantId,
      runId,
      nodeId: null,
      attempt: 0,
      kind: 'requirement_ir',
      status: 'ok',
      blobSha256: sha256,
      metadata: { placeholder: true },
      authorKind: 'user',
      pinned: false,
    })
  })

  const queue = new Queue(SCHEDULE_RUN_QUEUE, { connection: { url: redisUrl } })
  try {
    await queue.add('scheduleRun', { runId, tenantId })
  } finally {
    await queue.close()
  }

  return NextResponse.json({ ok: true, runId })
}
