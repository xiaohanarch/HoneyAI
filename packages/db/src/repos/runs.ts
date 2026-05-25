import { desc, eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from '../schema/index.js'
import { runs } from '../schema/runs.js'

export type NewRun = typeof runs.$inferInsert
export type Run = typeof runs.$inferSelect

export type CreateRunInput = Pick<
  NewRun,
  'tenantId' | 'repositoryId' | 'createdByUserId' | 'title' | 'oneLiner'
> &
  Partial<Pick<NewRun, 'targetBranch' | 'status' | 'id'>>

/**
 * Creates a new run with a client-generated uuidv7 id. Status defaults to
 * `'created'` (schema default) and `target_branch` defaults to `'main'`.
 *
 * Repository, tenant, and created_by_user_id are all required FKs.
 */
export async function createRun(
  db: NodePgDatabase<typeof schema>,
  input: CreateRunInput,
): Promise<Run> {
  const [row] = await db
    .insert(runs)
    .values({ id: input.id ?? uuidv7(), ...input })
    .returning()
  if (!row) throw new Error('createRun: insert returned no row')
  return row
}

/**
 * Returns the run by id, or `undefined` if not found.
 *
 * This repo is *not* tenant-scoped — call sites must compose with
 * `withTenant(db, tenantId)` to enforce isolation, or pass already-scoped
 * `db` in. Repo functions stay thin so they remain composable.
 */
export async function getRun(
  db: NodePgDatabase<typeof schema>,
  id: string,
): Promise<Run | undefined> {
  const [row] = await db.select().from(runs).where(eq(runs.id, id)).limit(1)
  return row
}

export type ListRunsOptions = {
  limit?: number
  offset?: number
}

/**
 * Lists runs for a tenant, newest first, with pagination.
 *
 * Defaults: limit=20, offset=0. Caller must supply tenantId explicitly
 * even when this is called inside a `withTenant(db, t)` scope — the proxy
 * adds the WHERE but the explicit arg keeps the repo signature honest
 * for direct (un-proxied) callers (migration, admin tools, tests).
 */
export async function listRunsByTenant(
  db: NodePgDatabase<typeof schema>,
  tenantId: string,
  { limit = 20, offset = 0 }: ListRunsOptions = {},
): Promise<Run[]> {
  return db
    .select()
    .from(runs)
    .where(eq(runs.tenantId, tenantId))
    .orderBy(desc(runs.createdAt))
    .limit(limit)
    .offset(offset)
}
