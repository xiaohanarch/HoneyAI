'use server'

import { eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { revalidatePath } from 'next/cache'
import { getDb } from '@honeyai/db'
import { gates } from '@honeyai/db/schema'
import { auth } from '@/lib/auth'

// ── Result types ────────────────────────────────────────────────────────────

type ErrorResult = { ok: false; code: string; message?: string }
type CreateRunOk = { ok: true; runId: string }
type CreateRunResult = CreateRunOk | ErrorResult
type ActionResult = { ok: true } | ErrorResult

// ── createRun ────────────────────────────────────────────────────────────────
// Phase 2.4.4 MOCK MODE: does not write real DB rows.
// Returns a fake runId so the UI can navigate to the detail page.
// TODO: replace with real insert once Orchestrator is ready (Phase 3).

export type CreateRunInput = { title: string; oneLiner: string }

export async function createRun(input: CreateRunInput): Promise<CreateRunResult> {
  const session = await auth()
  if (!session?.user?.tenantId) return { ok: false, code: 'UNAUTHENTICATED' }

  // Mock: generate a deterministic-looking runId, no DB write
  const runId = uuidv7()
  revalidatePath(`/t/${session.user.tenantSlug}/runs`)
  return { ok: true, runId }
}

// ── approveGate ──────────────────────────────────────────────────────────────

export type ApproveGateInput = { runId: string; nodeId: string }

export async function approveGate(input: ApproveGateInput): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.tenantId) return { ok: false, code: 'UNAUTHENTICATED' }

  const db = getDb()
  await db
    .update(gates)
    .set({ passedAt: new Date(), passedByUserId: session.user.id })
    .where(eq(gates.nodeId, input.nodeId))

  revalidatePath(`/t/${session.user.tenantSlug}/runs/${input.runId}`)
  return { ok: true }
}

// ── rejectGate ───────────────────────────────────────────────────────────────
// Rejection: mark gate as "not passed" by clearing passedAt.
// Phase 2.4.4: run status reset is handled by Orchestrator (not yet wired).

export type RejectGateInput = { runId: string; nodeId: string; reason: string }

export async function rejectGate(input: RejectGateInput): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.tenantId) return { ok: false, code: 'UNAUTHENTICATED' }

  const db = getDb()
  // Store rejection by setting passedAt to null and clearing passedByUserId
  await db
    .update(gates)
    .set({ passedAt: null, passedByUserId: null })
    .where(eq(gates.nodeId, input.nodeId))

  revalidatePath(`/t/${session.user.tenantSlug}/runs/${input.runId}`)
  return { ok: true }
}
