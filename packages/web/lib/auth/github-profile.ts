// packages/web/lib/auth/github-profile.ts
// Upserts a user record after successful GitHub OAuth sign-in.

import { getDb } from '@honeyai/db'
import { users } from '@honeyai/db/schema'
import { v7 as uuidv7 } from 'uuid'

export interface GitHubUserProfile {
  githubId: number
  githubLogin: string
  name: string | null
  email: string | null
  avatarUrl: string | null
}

/**
 * INSERT ... ON CONFLICT (github_id) DO UPDATE.
 * AC-07-03, AC-07-04
 */
export async function upsertGitHubUser(profile: GitHubUserProfile): Promise<void> {
  const db = getDb()
  await db
    .insert(users)
    .values({
      id: uuidv7(),
      githubId: profile.githubId,
      githubLogin: profile.githubLogin,
      name: profile.name,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
    })
    .onConflictDoUpdate({
      target: users.githubId,
      set: {
        githubLogin: profile.githubLogin,
        name: profile.name,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
      },
    })
}
