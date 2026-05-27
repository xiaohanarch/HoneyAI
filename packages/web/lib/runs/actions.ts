'use server'

import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { revalidatePath } from 'next/cache'
import { Queue } from 'bullmq'
import { getDb } from '@honeyai/db'
import { runs, artifacts, artifactBlobs, tenants } from '@honeyai/db/schema'
import { passGate, resumeFromGate } from '@honeyai/orchestrator'
import { decryptAnthropicKey } from '@honeyai/core'
import { SCHEDULE_RUN_QUEUE, ADVANCE_RUN_QUEUE } from '@honeyai/worker'
import { auth } from '@/lib/auth'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── Result types ────────────────────────────────────────────────────────────

type ErrorResult = { ok: false; code: string; message?: string }
type CreateRunOk = { ok: true; runId: string }
type CreateRunResult = CreateRunOk | ErrorResult
type ActionResult = { ok: true } | ErrorResult

// ── createRun ────────────────────────────────────────────────────────────────

export type CreateRunInput = { title: string; oneLiner: string }

export async function createRun(input: CreateRunInput): Promise<CreateRunResult> {
  const session = await auth()
  if (!session?.user?.tenantId) return { ok: false, code: 'UNAUTHENTICATED' }

  if (!input.title?.trim() || !input.oneLiner?.trim()) {
    return { ok: false, code: 'INVALID_INPUT' }
  }

  const db = getDb()

  // SELECT tenant to validate defaultRepoId and anthropicKeyCiphertext
  const tenantRows = await db.select().from(tenants).where(eq(tenants.id, session.user.tenantId))
  const tenant = tenantRows[0]

  if (!tenant?.defaultRepoId) {
    return { ok: false, code: 'NO_DEFAULT_REPO' }
  }

  const ciphertext = tenant.settings?.bootstrap?.anthropicKeyCiphertext
  if (!ciphertext) {
    return { ok: false, code: 'NO_ANTHROPIC_KEY' }
  }

  // Validate the key decodes — catch malformed envelope errors
  let plainKey: string
  try {
    plainKey = decryptAnthropicKey(ciphertext)
  } catch {
    return { ok: false, code: 'NO_ANTHROPIC_KEY' }
  }
  if (!plainKey) {
    return { ok: false, code: 'NO_ANTHROPIC_KEY' }
  }

  const redisUrl = process.env['REDIS_URL']
  if (!redisUrl) {
    return { ok: false, code: 'REDIS_NOT_CONFIGURED' }
  }

  const runId = uuidv7()
  const tenantId = session.user.tenantId

  // Wrap all three inserts in a transaction so partial writes don't persist on failure
  const sha256 = createHash('sha256').update(input.oneLiner).digest('hex')
  const byteSize = BigInt(Buffer.from(input.oneLiner).length)
  const ossKey = `placeholder/${runId}/requirement_ir.md`

  await db.transaction(async (tx) => {
    await tx.insert(runs).values({
      id: runId,
      status: 'created',
      tenantId,
      repositoryId: tenant.defaultRepoId!,
      createdByUserId: session.user.id,
      title: input.title,
      oneLiner: input.oneLiner,
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

  // Enqueue scheduleRun job after the transaction commits
  const queue = new Queue(SCHEDULE_RUN_QUEUE, { connection: { url: redisUrl } })
  try {
    await queue.add('scheduleRun', { runId, tenantId })
  } finally {
    await queue.close()
  }

  revalidatePath(`/t/${session.user.tenantSlug}/runs`)
  return { ok: true, runId }
}

// ── approveGate ──────────────────────────────────────────────────────────────

export type ApproveGateInput = { runId: string; nodeId: string }

export async function approveGate(input: ApproveGateInput): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.tenantId) return { ok: false, code: 'UNAUTHENTICATED' }

  if (!UUID_RE.test(input.runId) || !UUID_RE.test(input.nodeId)) {
    return { ok: false, code: 'INVALID_INPUT' }
  }

  const db = getDb()

  const result = await passGate(db, input.nodeId, session.user.id)
  if (!result.ok) {
    if (result.reason === 'not_viewed') {
      return { ok: false, code: 'GATE_NOT_VIEWED' }
    }
    return { ok: false, code: 'GATE_ERROR' }
  }

  const redisUrl = process.env['REDIS_URL']
  if (!redisUrl) {
    return { ok: false, code: 'REDIS_NOT_CONFIGURED' }
  }

  const queue = new Queue(ADVANCE_RUN_QUEUE, { connection: { url: redisUrl } })
  try {
    await queue.add('advanceRun', {
      runId: input.runId,
      tenantId: session.user.tenantId,
      completedNodeId: input.nodeId,
    })
  } finally {
    await queue.close()
  }

  revalidatePath(`/t/${session.user.tenantSlug}/runs/${input.runId}`)
  return { ok: true }
}

// ── rejectGate ───────────────────────────────────────────────────────────────

export type RejectGateInput = { runId: string; nodeId: string; reason?: string }

export async function rejectGate(input: RejectGateInput): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.tenantId) return { ok: false, code: 'UNAUTHENTICATED' }

  if (!UUID_RE.test(input.runId) || !UUID_RE.test(input.nodeId)) {
    return { ok: false, code: 'INVALID_INPUT' }
  }

  const db = getDb()
  try {
    await resumeFromGate(db, input.runId, input.nodeId, session.user.id, 'reject')
  } catch {
    return { ok: false, code: 'REJECT_FAILED' }
  }

  revalidatePath(`/t/${session.user.tenantSlug}/runs/${input.runId}`)
  return { ok: true }
}
