'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { sql } from 'drizzle-orm'
import { getDb } from '@honeyai/db'
import { tenants } from '@honeyai/db/schema'
import { auth } from '@/lib/auth'
import { encryptAnthropicKey } from '@honeyai/core'
import { getTenantBootstrap } from '@/lib/bootstrap/read'
import type { WelcomeActionResult } from '@/lib/errors/welcome-errors'

const KEY_RE = /^sk-ant-[A-Za-z0-9_-]{32,}$/
const step1Schema = z.object({ key: z.string().regex(KEY_RE) })

async function requireTenantCtx(): Promise<
  | { error: { ok: false; code: 'UNAUTHENTICATED' } }
  | { tenantId: string; tenantSlug: string | null | undefined }
> {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return { error: { ok: false as const, code: 'UNAUTHENTICATED' as const } }
  }
  return { tenantId: session.user.tenantId, tenantSlug: session.user.tenantSlug }
}

async function patchBootstrap(tenantId: string, patch: Record<string, unknown>) {
  const db = getDb()
  await db
    .update(tenants)
    .set({
      settings: sql`COALESCE(${tenants.settings}, '{}'::jsonb) || ${JSON.stringify({ bootstrap: patch })}::jsonb`,
    })
    .where(sql`${tenants.id} = ${tenantId}`)
  revalidatePath('/welcome', 'layout')
}

export async function submitStep1(
  _prev: WelcomeActionResult,
  fd: FormData,
): Promise<WelcomeActionResult> {
  const ctx = await requireTenantCtx()
  if ('error' in ctx) return ctx.error
  const existing = await getTenantBootstrap(ctx.tenantId)
  if (existing?.bootstrap?.completedAt) {
    return { ok: false, code: 'BOOTSTRAP_ALREADY_COMPLETE' }
  }
  const parsed = step1Schema.safeParse({ key: fd.get('key') })
  if (!parsed.success) return { ok: false, code: 'INVALID_KEY_FORMAT', field: 'key' }
  const cipher = encryptAnthropicKey(parsed.data.key)
  await patchBootstrap(ctx.tenantId, {
    ...(existing?.bootstrap ?? {}),
    anthropicKeyCiphertext: cipher,
  })
  redirect('/welcome/step/2')
}
