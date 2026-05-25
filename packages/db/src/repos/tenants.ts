import { v7 as uuidv7 } from 'uuid'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from '../schema/index.js'
import { tenants } from '../schema/identity.js'

export type NewTenant = typeof tenants.$inferInsert
export type Tenant = typeof tenants.$inferSelect

/**
 * Creates a new tenant with an auto-generated uuidv7 id.
 *
 * `tenants.id` has no DEFAULT in the schema (deliberate — ids are generated
 * client-side so we can include them in audit logs / outbox payloads before
 * the INSERT round-trips). Callers may override `id` to supply an explicit one.
 */
export async function createTenant(
  db: NodePgDatabase<typeof schema>,
  input: Pick<NewTenant, 'slug' | 'name'> & Partial<Pick<NewTenant, 'kind' | 'id'>>,
): Promise<Tenant> {
  const [row] = await db
    .insert(tenants)
    .values({ id: input.id ?? uuidv7(), ...input })
    .returning()
  if (!row) throw new Error('createTenant: insert returned no row')
  return row
}
