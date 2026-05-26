// packages/web/lib/auth/dev-credentials.ts
// Dev-only fixture users for NextAuth v5 Credentials provider (ADR-029).
// GUARD: this module throws at import time outside development.
// In production, NODE_ENV=production + DEV_AUTH_ENABLED absent ensures this
// module is NEVER imported — the auth config conditionally omits the provider.

if (process.env['NODE_ENV'] !== 'development' || process.env['DEV_AUTH_ENABLED'] !== 'true') {
  throw new Error('DEV_CREDENTIALS: only available in development with DEV_AUTH_ENABLED=true')
}

export type DevUser = {
  id: string
  username: string
  password: string
  name: string
  email: string
}

// Fixture users — alice / bob / carol / dave.
// Passwords are non-secret dev values; documented in .env.example.
export const DEV_USERS: DevUser[] = [
  {
    id: 'dev-user-alice',
    username: 'alice',
    password: 'dev-alice',
    name: 'alice',
    email: 'alice@dev.local',
  },
  {
    id: 'dev-user-bob',
    username: 'bob',
    password: 'dev-bob',
    name: 'bob',
    email: 'bob@dev.local',
  },
  {
    id: 'dev-user-carol',
    username: 'carol',
    password: 'dev-carol',
    name: 'carol',
    email: 'carol@dev.local',
  },
  {
    id: 'dev-user-dave',
    username: 'dave',
    password: 'dev-dave',
    name: 'dave',
    email: 'dave@dev.local',
  },
]

/**
 * Authorize function for NextAuth v5 Credentials provider.
 * Plain-text comparison is acceptable for dev-only fixture data (no real users).
 * Returns a user object compatible with NextAuth's `User` type, or null on mismatch.
 */
export async function authorizeDevCredentials(
  credentials: Record<string, string> | undefined,
): Promise<{ id: string; name: string; email: string } | null> {
  if (!credentials) return null
  const { username, password } = credentials
  const found = DEV_USERS.find((u) => u.username === username && u.password === password)
  if (!found) return null
  return { id: found.id, name: found.name, email: found.email }
}
