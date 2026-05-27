import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { eq, sql, and } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { getDb } from '@honeyai/db'
import { tenants, repositories, githubInstallations } from '@honeyai/db/schema'
import { encryptAnthropicKey } from '@honeyai/core'
import { auth } from '@/lib/auth'

const KEY_RE = /^sk-ant-/
const REPO_RE = /^[\w.-]+\/[\w.-]+$/

// ---------------------------------------------------------------------------
// GET — return current configuration status
// ---------------------------------------------------------------------------

export async function GET() {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = session.user.tenantId
  const db = getDb()

  const tenantRows = await db
    .select({
      slug: tenants.slug,
      settings: tenants.settings,
      defaultRepoId: tenants.defaultRepoId,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  const tenant = tenantRows[0]
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const hasAnthropicKey = !!tenant.settings?.bootstrap?.anthropicKeyCiphertext
  const hasRepo = !!tenant.defaultRepoId

  let repoName: string | null = null
  if (tenant.defaultRepoId) {
    const repoRows = await db
      .select({ owner: repositories.owner, name: repositories.name })
      .from(repositories)
      .where(eq(repositories.id, tenant.defaultRepoId))
      .limit(1)
    const repo = repoRows[0]
    if (repo) {
      repoName = repo.owner + '/' + repo.name
    }
  }

  return NextResponse.json({
    hasAnthropicKey,
    hasRepo,
    tenantSlug: tenant.slug ?? null,
    repoName,
  })
}

// ---------------------------------------------------------------------------
// POST — save key or repo
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = session.user.tenantId

  let body: { action?: string; value?: string }
  try {
    body = (await req.json()) as { action?: string; value?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action, value } = body
  if (!action || !value) {
    return NextResponse.json({ error: 'action and value are required' }, { status: 400 })
  }

  const db = getDb()

  // -------------------------------------------------------------------------
  // action='key' — encrypt and persist the Anthropic API key
  // -------------------------------------------------------------------------
  if (action === 'key') {
    if (!KEY_RE.test(value)) {
      return NextResponse.json({ error: 'INVALID_KEY_FORMAT' }, { status: 400 })
    }

    const cipher = encryptAnthropicKey(value)

    await db.execute(
      sql`UPDATE tenants SET settings = jsonb_set(COALESCE(settings, '{}'), '{bootstrap,anthropicKeyCiphertext}', ${JSON.stringify(cipher)}::jsonb) WHERE id = ${tenantId}`,
    )

    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------------------
  // action='repo' — link or create a repository record for the tenant
  // -------------------------------------------------------------------------
  if (action === 'repo') {
    if (!REPO_RE.test(value)) {
      return NextResponse.json({ error: 'INVALID_REPO_FORMAT' }, { status: 400 })
    }

    const slashIdx = value.indexOf('/')
    const owner = value.slice(0, slashIdx)
    const name = value.slice(slashIdx + 1)

    // Look for an existing repository record for this tenant+owner+name
    const matchRows = await db
      .select({ id: repositories.id })
      .from(repositories)
      .where(
        and(
          eq(repositories.tenantId, tenantId),
          eq(repositories.owner, owner),
          eq(repositories.name, name),
        ),
      )
      .limit(1)

    const found = matchRows[0]
    if (found) {
      await db.update(tenants).set({ defaultRepoId: found.id }).where(eq(tenants.id, tenantId))
      return NextResponse.json({ ok: true, repoId: found.id })
    }

    // No existing record — we need a githubInstallations row as FK
    // Find the first available installation (best effort for prototype)
    const installationRows = await db
      .select({ id: githubInstallations.id })
      .from(githubInstallations)
      .limit(1)

    let installationId: string
    if (installationRows[0]) {
      installationId = installationRows[0].id
    } else {
      // Create a placeholder installation so the FK constraint is satisfied
      installationId = uuidv7()
      await db.insert(githubInstallations).values({
        id: installationId,
        installationId: 0,
        accountLogin: owner,
        accountType: 'User',
      })
    }

    const repoId = uuidv7()
    await db.transaction(async (tx) => {
      await tx.insert(repositories).values({
        id: repoId,
        tenantId,
        installationId,
        githubRepoId: 0,
        owner,
        name,
        defaultBranch: 'main',
        isEnabled: true,
      })
      await tx.update(tenants).set({ defaultRepoId: repoId }).where(eq(tenants.id, tenantId))
    })

    return NextResponse.json({ ok: true, repoId })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
