import { cache } from 'react'
import { eq } from 'drizzle-orm'
import { getDb } from '@honeyai/db'
import { tenants } from '@honeyai/db/schema'
import type { TenantBootstrapState } from '@honeyai/db/schema'

export type TenantBootstrapReadResult = {
  slug: string
  bootstrap: TenantBootstrapState | null
}

export const getTenantBootstrap = cache(
  async (tenantId: string): Promise<TenantBootstrapReadResult | null> => {
    const db = getDb()
    const rows = await db
      .select({ slug: tenants.slug, settings: tenants.settings })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1)
    const row = rows[0]
    if (!row) return null
    return { slug: row.slug, bootstrap: row.settings?.bootstrap ?? null }
  },
)
