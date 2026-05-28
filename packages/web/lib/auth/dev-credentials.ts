// packages/web/lib/auth/dev-credentials.ts
// Dev/demo fixture users for NextAuth v5 Credentials provider (ADR-029).
// GUARD: this module throws at import time when DEV_AUTH_ENABLED is absent.
// Only imported when DEV_AUTH_ENABLED=true is explicitly set (dev or demo deployments).

if (process.env['DEV_AUTH_ENABLED'] !== 'true') {
  throw new Error('DEV_CREDENTIALS: only available with DEV_AUTH_ENABLED=true')
}

export type DevUser = {
  id: string
  username: string
  password: string
  name: string
  email: string
  tenantId: string
  tenantSlug: string
}

// Fixture users — alice / bob / carol / dave.
// Passwords are non-secret dev values; documented in .env.example.
// IDs and tenantIds are stable hardcoded uuidv7-shaped strings (not generated at runtime).
export const DEV_USERS: DevUser[] = [
  {
    id: '01914aa0-0001-7000-8000-000000000001',
    username: 'alice',
    password: 'dev-alice',
    name: 'alice',
    email: 'alice@dev.local',
    tenantId: '01914ab0-0001-7000-8000-000000000001',
    tenantSlug: 'alice',
  },
  {
    id: '01914aa0-0002-7000-8000-000000000002',
    username: 'bob',
    password: 'dev-bob',
    name: 'bob',
    email: 'bob@dev.local',
    tenantId: '01914ab0-0002-7000-8000-000000000002',
    tenantSlug: 'bob',
  },
  {
    id: '01914aa0-0003-7000-8000-000000000003',
    username: 'carol',
    password: 'dev-carol',
    name: 'carol',
    email: 'carol@dev.local',
    tenantId: '01914ab0-0003-7000-8000-000000000003',
    tenantSlug: 'carol',
  },
  {
    id: '01914aa0-0004-7000-8000-000000000004',
    username: 'dave',
    password: 'dev-dave',
    name: 'dave',
    email: 'dave@dev.local',
    tenantId: '01914ab0-0004-7000-8000-000000000004',
    tenantSlug: 'dave',
  },
]

/**
 * Authorize function for NextAuth v5 Credentials provider.
 * Plain-text comparison is acceptable for dev-only fixture data (no real users).
 * Returns a user object compatible with NextAuth's `User` type, or null on mismatch.
 */
export async function authorizeDevCredentials(
  credentials: Record<string, string> | undefined,
): Promise<{
  id: string
  name: string
  email: string
  tenantId: string
  tenantSlug: string
} | null> {
  if (!credentials) return null
  const { username, password } = credentials
  const found = DEV_USERS.find((u) => u.username === username && u.password === password)
  if (!found) return null
  return {
    id: found.id,
    name: found.name,
    email: found.email,
    tenantId: found.tenantId,
    tenantSlug: found.tenantSlug,
  }
}

export const authorizeDevUser = authorizeDevCredentials
