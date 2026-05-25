import { eq, getTableName } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { PgTable } from 'drizzle-orm/pg-core'
import type * as schema from '../schema/index.js'

/**
 * Set of tables that carry a `tenant_id` column and must be auto-scoped.
 *
 * Phase 1: hardcoded list of tenant-scoped table names. Task G4 will replace
 * this with schema reflection (iterate schema exports, detect `tenantId` column).
 *
 * Note: `tenants` itself is NOT in this set — its primary key `id` is the
 * tenant identifier (no `tenant_id` column).
 */
const SCOPED_TABLES = new Set<string>([
  'tenant_members',
  'repositories',
  'runs',
  'artifacts',
  'ir_documents',
  'assets',
  'asset_sources',
  'asset_versions',
  'cost_events',
  'audit_log',
  'activity_feed',
])

/**
 * Returns a Proxy over the given drizzle db that auto-injects
 * `WHERE tenant_id = <tenantId>` for `select()` queries against scoped tables.
 *
 * AC-03-01 minimal scope: intercept `db.select().from(scopedTable)` and append
 * a tenant_id filter. Tasks G2/G3 will add cross-tenant audit logging and
 * artifact idempotency support.
 *
 * Known Phase 1 limitation (G1 only): if the caller subsequently calls
 * `.where(...)` on the returned builder, drizzle overwrites the existing
 * WHERE — that case is addressed in G2 via post-execute audit hook.
 */
export function withTenant<S extends typeof schema>(
  db: NodePgDatabase<S>,
  tenantId: string,
): NodePgDatabase<S> {
  return new Proxy(db, {
    get(target, prop, receiver) {
      const orig = Reflect.get(target, prop, receiver)
      if (prop !== 'select') return orig
      return (...args: unknown[]) => {
        const builder = (orig as (...a: unknown[]) => unknown).apply(target, args) as {
          from: (table: PgTable) => unknown
        }
        const fromOrig = builder.from.bind(builder)
        builder.from = (table: PgTable) => {
          const q = fromOrig(table) as { where: (expr: unknown) => unknown }
          if (SCOPED_TABLES.has(getTableName(table))) {
            const tenantCol = (table as unknown as { tenantId: unknown }).tenantId
            return q.where(eq(tenantCol as never, tenantId))
          }
          return q
        }
        return builder as unknown
      }
    },
  }) as NodePgDatabase<S>
}
