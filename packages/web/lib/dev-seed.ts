// packages/web/lib/dev-seed.ts
// Idempotent seeder for dev fixture tenants / users / memberships.
// Only runs when devAuthEnabled=true (DEV_AUTH_ENABLED env gate at call-site).
// See ADR-048 + ADR-050.
import type { DrizzleDb } from '@honeyai/db'
import { tenants, users, tenantMembers } from '@honeyai/db/schema'

export type SeedOptions = { devAuthEnabled: boolean }

export async function seedDevTenants(db: DrizzleDb, opts: SeedOptions): Promise<void> {
  if (!opts.devAuthEnabled) return

  // Dynamic import avoids triggering dev-credentials guard at module-load time.
  // The guard requires NODE_ENV=development + DEV_AUTH_ENABLED=true, which are
  // both satisfied when this function is called (opts.devAuthEnabled gate above).
  const { DEV_USERS } = await import('./auth/dev-credentials')

  await db.transaction(async (tx) => {
    for (const u of DEV_USERS) {
      await tx
        .insert(tenants)
        .values({ id: u.tenantId, slug: u.tenantSlug, name: u.tenantSlug, kind: 'personal' })
        .onConflictDoNothing()
      // users.githubId + githubLogin are NOT NULL in schema — synthesise stable
      // dev-only values derived from the user's position in DEV_USERS.
      const idx = DEV_USERS.indexOf(u)
      await tx
        .insert(users)
        .values({
          id: u.id,
          email: u.email,
          name: u.name,
          githubId: 900_000 + idx,
          githubLogin: u.username,
        })
        .onConflictDoNothing()
      await tx
        .insert(tenantMembers)
        .values({ tenantId: u.tenantId, userId: u.id, role: 'owner' })
        .onConflictDoNothing()
    }
  })
}
