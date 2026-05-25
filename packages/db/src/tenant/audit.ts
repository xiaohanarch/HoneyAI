import { v7 as uuidv7 } from 'uuid'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from '../schema/index.js'
import { auditLog } from '../schema/audit.js'

/**
 * Records a cross-tenant access attempt in `audit_log`.
 *
 * Called by the `withTenant` Proxy when a scoped SELECT returned 0 rows
 * but a probe (without the tenant filter) shows the row exists for another
 * tenant — i.e. tenant A actively reached for tenant B's data.
 *
 * `actorUserId` is intentionally null in Phase 1 — Phase 2 will thread an
 * actor through the proxy via AsyncLocalStorage / explicit ctx.
 */
export async function logCrossTenantAttempt(
  db: NodePgDatabase<typeof schema>,
  tenantId: string,
  tableName: string,
  attemptedId: string | null,
): Promise<void> {
  await db.insert(auditLog).values({
    id: uuidv7(),
    tenantId,
    actorUserId: null,
    action: 'cross_tenant_attempt',
    targetKind: tableName,
    targetId: attemptedId ?? '',
    payload: {},
  })
}
