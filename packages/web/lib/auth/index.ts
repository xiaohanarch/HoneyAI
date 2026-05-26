// packages/web/lib/auth/index.ts
// NextAuth v5 configuration — unified entry point (ADR-029).
// Exports: { handlers, auth, signIn, signOut }
// Strategy: JWT (no DB session table — consistent with GitHub OAuth provider in slice 3)
// Credentials provider is conditionally included in development only.

import NextAuth from 'next-auth'
import type { NextAuthConfig } from 'next-auth'
import './types'

// Conditionally load dev credentials — throws in production (guard in dev-credentials.ts)
async function buildProviders() {
  if (process.env['NODE_ENV'] === 'development' && process.env['DEV_AUTH_ENABLED'] === 'true') {
    const Credentials = (await import('next-auth/providers/credentials')).default
    const { authorizeDevCredentials } = await import('./dev-credentials')
    return [
      Credentials({
        name: 'Dev Credentials',
        credentials: {
          username: { label: 'Username', type: 'text' },
          password: { label: 'Password', type: 'password' },
        },
        authorize: async (credentials, _request) => {
          // NextAuth v5 expects (credentials, request) signature
          // Ignore request, delegate to authorizeDevCredentials
          // credentials comes in as Partial<Record<K, unknown>>; cast to Record<string, string>
          return authorizeDevCredentials(credentials as Record<string, string>)
        },
      }),
    ]
  }
  // Production: GitHub OAuth provider will be added in slice 3 (ADR-029 §consequences)
  return []
}

/**
 * Named JWT callback — extracted for testability (ADR-048 JT3).
 * Propagates id, tenantId, and tenantSlug from the User object into the JWT token
 * on first sign-in. Subsequent calls (no user) return the token unchanged.
 */
export async function jwtCallback({
  token,
  user,
}: {
  token: Record<string, unknown>
  user?: { id?: string; tenantId?: string | null; tenantSlug?: string | null }
}): Promise<Record<string, unknown>> {
  if (user) {
    // user.id is set by Credentials authorize return value
    token['id'] = user.id ?? ''
    token['tenantId'] = user.tenantId ?? null
    token['tenantSlug'] = user.tenantSlug ?? null
  }
  return token
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jwtCallbackForConfig = jwtCallback as any

/**
 * Named session callback — extracted for testability (ADR-048 review followup).
 * Propagates id, tenantId, and tenantSlug from the JWT token into the Session user object.
 */
export async function sessionCallback({
  session,
  token,
}: {
  session: { user: Record<string, unknown>; expires: string }
  token: Record<string, unknown>
}): Promise<typeof session> {
  session.user.id = String(token['id'] ?? '')
  session.user.tenantId = (token['tenantId'] as string | null) ?? null
  session.user.tenantSlug = (token['tenantSlug'] as string | null) ?? null
  return session
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sessionCallbackForConfig = sessionCallback as any

const config: NextAuthConfig = {
  providers: await buildProviders(),
  session: { strategy: 'jwt' },
  callbacks: {
    jwt: jwtCallbackForConfig,
    session: sessionCallbackForConfig,
  },
  pages: {
    signIn: '/login',
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(config)
