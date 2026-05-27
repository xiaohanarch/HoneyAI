'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { eq, sql } from 'drizzle-orm'
import { getDb } from '@honeyai/db'
import { tenants } from '@honeyai/db/schema'
import { auth } from '@/lib/auth'
import { encryptAnthropicKey } from '@honeyai/core'
import { getTenantBootstrap } from '@/lib/bootstrap/read'
import type { WelcomeActionResult } from '@/lib/errors/welcome-errors'
import { zhWelcomeServerMessages } from '@/lib/strings/zh'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type TenantCtx = { tenantId: string; tenantSlug: string | null | undefined }
type Bootstrap = NonNullable<Awaited<ReturnType<typeof getTenantBootstrap>>>['bootstrap']

type BootstrapWritableOk = {
  ok: true
  ctx: TenantCtx
  bootstrap: Bootstrap
}
type BootstrapWritableErr = { ok: false; result: WelcomeActionResult }

/**
 * Common preamble for all welcome step actions:
 *   - require an authed tenant session
 *   - load tenant bootstrap
 *   - reject if bootstrap already completed
 *   - (optionally) reject if a prerequisite key is falsy on bootstrap
 *
 * Returns { ok: true, ctx, bootstrap } on success, or { ok: false, result }
 * carrying a ready-to-return WelcomeActionResult on rejection.
 *
 * Race note (V1): the read here and the write in patchBootstrap are not atomic.
 * Acceptable for single-user-per-tenant bootstrap; if concurrent bootstrap
 * becomes a real concern, add a transaction + advisory lock.
 */
async function requireWritableBootstrap(opts: {
  requireKey?: keyof NonNullable<Bootstrap>
  prereqMessage?: string
}): Promise<BootstrapWritableOk | BootstrapWritableErr> {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return { ok: false, result: { ok: false, code: 'UNAUTHENTICATED' } }
  }
  const ctx: TenantCtx = {
    tenantId: session.user.tenantId,
    tenantSlug: session.user.tenantSlug,
  }

  const existing = await getTenantBootstrap(ctx.tenantId)
  const bootstrap = existing?.bootstrap ?? null

  if (bootstrap?.completedAt) {
    return { ok: false, result: { ok: false, code: 'BOOTSTRAP_ALREADY_COMPLETE' } }
  }

  if (opts.requireKey !== undefined && !bootstrap?.[opts.requireKey]) {
    return {
      ok: false,
      result: {
        ok: false,
        code: 'INTERNAL_ERROR',
        message: opts.prereqMessage,
      },
    }
  }

  return { ok: true, ctx, bootstrap }
}

async function patchBootstrap(tenantId: string, patch: Record<string, unknown>) {
  const db = getDb()
  await db
    .update(tenants)
    .set({
      settings: sql`COALESCE(${tenants.settings}, '{}'::jsonb) || ${JSON.stringify({ bootstrap: patch })}::jsonb`,
    })
    .where(eq(tenants.id, tenantId))
  revalidatePath('/welcome', 'layout')
}

// ---------------------------------------------------------------------------
// Step 1 — Anthropic API Key
// ---------------------------------------------------------------------------

const KEY_RE = /^sk-ant-[A-Za-z0-9_-]{32,}$/
const step1Schema = z.object({ key: z.string().regex(KEY_RE) })

export async function submitStep1(
  _prev: WelcomeActionResult,
  fd: FormData,
): Promise<WelcomeActionResult> {
  const guard = await requireWritableBootstrap({})
  if (!guard.ok) return guard.result

  const parsed = step1Schema.safeParse({ key: fd.get('key') })
  if (!parsed.success) return { ok: false, code: 'INVALID_KEY_FORMAT', field: 'key' }
  const cipher = encryptAnthropicKey(parsed.data.key)
  await patchBootstrap(guard.ctx.tenantId, {
    ...(guard.bootstrap ?? {}),
    anthropicKeyCiphertext: cipher,
  })
  redirect('/welcome/step/2')
}

// ---------------------------------------------------------------------------
// Step 2 — GitHub App install
// ---------------------------------------------------------------------------

const step2Schema = z.object({ confirm: z.literal('on') })

export async function submitStep2(
  _prev: WelcomeActionResult,
  fd: FormData,
): Promise<WelcomeActionResult> {
  const guard = await requireWritableBootstrap({
    requireKey: 'anthropicKeyCiphertext',
    prereqMessage: zhWelcomeServerMessages.step2Prereq,
  })
  if (!guard.ok) return guard.result

  const parsed = step2Schema.safeParse({ confirm: fd.get('confirm') })
  if (!parsed.success) return { ok: false, code: 'INTERNAL_ERROR' }

  await patchBootstrap(guard.ctx.tenantId, {
    ...(guard.bootstrap ?? {}),
    githubAppInstalled: true,
    githubAppMarkedAt: new Date().toISOString(),
  })
  redirect('/welcome/step/3')
}

// ---------------------------------------------------------------------------
// Step 3 — GitHub repo selection
// ---------------------------------------------------------------------------

const REPO_RE = /^[\w.-]+\/[\w.-]+$/
const step3Schema = z.object({ repo: z.string().regex(REPO_RE) })

export async function submitStep3(
  _prev: WelcomeActionResult,
  fd: FormData,
): Promise<WelcomeActionResult> {
  const guard = await requireWritableBootstrap({
    requireKey: 'githubAppInstalled',
    prereqMessage: zhWelcomeServerMessages.step3Prereq,
  })
  if (!guard.ok) return guard.result

  const parsed = step3Schema.safeParse({ repo: fd.get('repo') })
  if (!parsed.success) return { ok: false, code: 'INVALID_REPO_FORMAT', field: 'repo' }

  await patchBootstrap(guard.ctx.tenantId, {
    ...(guard.bootstrap ?? {}),
    pendingRepoOwnerName: parsed.data.repo,
  })
  redirect('/welcome/step/4')
}

// ---------------------------------------------------------------------------
// Step 4 — Default skills import / skip
// ---------------------------------------------------------------------------

export async function submitStep4(
  _prev: WelcomeActionResult,
  fd: FormData,
): Promise<WelcomeActionResult> {
  const guard = await requireWritableBootstrap({
    requireKey: 'pendingRepoOwnerName',
    prereqMessage: zhWelcomeServerMessages.step4Prereq,
  })
  if (!guard.ok) return guard.result

  const action = fd.get('action')
  const applied = action === 'import' ? 'imported' : ('skipped' as const)

  const db = getDb()
  await db.transaction(async (tx) => {
    if (action === 'import') {
      const { importDefaultSkills } = await import('@/lib/seeds/default-skills')
      await importDefaultSkills(tx, guard.ctx.tenantId)
    }
    await tx
      .update(tenants)
      .set({
        settings: sql`COALESCE(${tenants.settings}, '{}'::jsonb) || ${JSON.stringify({
          bootstrap: {
            ...(guard.bootstrap ?? {}),
            defaultSkillsApplied: applied,
            completedAt: new Date().toISOString(),
          },
        })}::jsonb`,
      })
      .where(eq(tenants.id, guard.ctx.tenantId))
  })
  // tenantSlug is required to redirect to the tenant dashboard; guard against
  // null/undefined to avoid a silent /t/null redirect.
  const slug = guard.ctx.tenantSlug
  if (!slug) return { ok: false, code: 'INTERNAL_ERROR' }

  revalidatePath('/welcome', 'layout')
  revalidatePath(`/t/${slug}/runs`, 'layout')
  redirect(`/t/${slug}/runs`)
}
