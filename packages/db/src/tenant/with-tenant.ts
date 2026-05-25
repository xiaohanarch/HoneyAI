import { and, eq, getTableName, is, Table, type SQL } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { PgTable } from 'drizzle-orm/pg-core'
import * as schema from '../schema/index.js'
import { logCrossTenantAttempt } from './audit.js'

/**
 * Set of table names that carry a `tenant_id` column and must be auto-scoped
 * by `withTenant`. Built at module-load time by reflecting over the schema
 * barrel — adding a new tenant-scoped table automatically extends this set
 * with no source-of-truth duplication.
 *
 * `tenants` itself is NOT in this set — its primary key `id` IS the tenant
 * identifier; it has no `tenant_id` column.
 */
export const SCOPED_TABLES: ReadonlySet<string> = new Set(
  (Object.values(schema) as unknown[])
    .filter((v): v is Table => is(v, Table))
    .filter((t) => (t as unknown as Record<string, unknown>).tenantId !== undefined)
    .map((t) => getTableName(t)),
)

/**
 * Returns a Proxy over `db` that, for `select().from(scopedTable)`:
 *
 * 1. Auto-injects `WHERE tenant_id = <tenantId>` — combined with any
 *    user-supplied `.where()` via `and()` (so user filters don't
 *    overwrite the tenant guard).
 * 2. On execution, if 0 rows returned AND the user supplied a `.where()`,
 *    probes the raw db (no tenant filter) — if the probe finds the row,
 *    writes a `cross_tenant_attempt` audit_log entry under the
 *    bound tenant.
 *
 * Implementation notes:
 *
 * - `.where()` is captured (not applied) and only combined at execution
 *   time. This survives drizzle's behaviour of overwriting WHERE on
 *   subsequent `.where()` calls.
 * - Execution is intercepted via `.then()` — drizzle queries are thenable;
 *   `await q` calls into `q.then`.
 * - The probe + audit log run *before* the awaiter resolves, so callers
 *   that immediately read `audit_log` see the entry deterministically.
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
          const q = fromOrig(table) as Record<string, unknown>
          const tableName = getTableName(table)
          if (!SCOPED_TABLES.has(tableName)) return q

          const tenantCol = (table as unknown as { tenantId: unknown }).tenantId
          const tenantFilter = eq(tenantCol as never, tenantId) as SQL

          let userWhere: SQL | undefined
          const origWhere = (q.where as (e: SQL) => unknown).bind(q)
          q.where = (expr: SQL) => {
            userWhere = expr
            return q
          }

          const origThen = (q.then as Promise<unknown>['then']).bind(
            q as unknown as Promise<unknown>,
          )
          q.then = (onFulfilled: unknown, onRejected: unknown) => {
            const combined = userWhere ? and(tenantFilter, userWhere) : tenantFilter
            origWhere(combined as SQL)

            const exec = origThen(undefined, undefined) as Promise<unknown[]>

            const wrapped = exec.then(async (rows) => {
              if (userWhere && rows.length === 0) {
                const probeBuilder = (target as NodePgDatabase<S>).select().from(table) as {
                  where: (e: SQL) => { limit: (n: number) => Promise<unknown[]> }
                }
                const probe = await probeBuilder.where(userWhere).limit(1)
                if (probe.length > 0) {
                  await logCrossTenantAttempt(
                    target as unknown as NodePgDatabase<typeof schema>,
                    tenantId,
                    tableName,
                    null,
                  )
                }
              }
              return rows
            })

            return wrapped.then(
              onFulfilled as ((v: unknown[]) => unknown) | null | undefined,
              onRejected as ((reason: unknown) => unknown) | null | undefined,
            )
          }

          return q
        }
        return builder as unknown
      }
    },
  }) as NodePgDatabase<S>
}
