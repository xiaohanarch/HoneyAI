import { v7 as uuidv7 } from 'uuid'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from '../schema/index.js'
import { users } from '../schema/identity.js'

export type NewUser = typeof users.$inferInsert
export type User = typeof users.$inferSelect

/**
 * Creates a new global user (Auth.js / GitHub identity). Users are *not*
 * tenant-scoped — tenant membership is tracked separately in `tenant_members`.
 *
 * `users.id` has no DEFAULT; ids are generated client-side via uuidv7.
 * Callers may override `id` to supply an explicit one.
 */
export async function createUser(
  db: NodePgDatabase<typeof schema>,
  input: Pick<NewUser, 'githubId' | 'githubLogin'> &
    Partial<Pick<NewUser, 'email' | 'name' | 'avatarUrl' | 'isPlatformAdmin' | 'id'>>,
): Promise<User> {
  const [row] = await db
    .insert(users)
    .values({ id: input.id ?? uuidv7(), ...input })
    .returning()
  if (!row) throw new Error('createUser: insert returned no row')
  return row
}
