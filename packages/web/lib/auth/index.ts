// packages/web/lib/auth/index.ts
// NextAuth v5 configuration — unified entry point (ADR-029).
// Exports: { handlers, auth, signIn, signOut }
// Strategy: JWT (no DB session table — consistent with GitHub OAuth provider in slice 3)
// Credentials provider is conditionally included in development only.

import NextAuth from 'next-auth'
import type { NextAuthConfig } from 'next-auth'
import './types.js'

// Conditionally load dev credentials — throws in production (guard in dev-credentials.ts)
async function buildProviders() {
  if (process.env['NODE_ENV'] === 'development' && process.env['DEV_AUTH_ENABLED'] === 'true') {
    const Credentials = (await import('next-auth/providers/credentials')).default
    const { authorizeDevCredentials } = await import('./dev-credentials.js')
    return [
      Credentials({
        name: 'Dev Credentials',
        credentials: {
          username: { label: 'Username', type: 'text' },
          password: { label: 'Password', type: 'password' },
        },
        authorize: async (credentials, request) => {
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

const config: NextAuthConfig = {
  providers: await buildProviders(),
  session: { strategy: 'jwt' },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        // user.id is set by Credentials authorize return value
        token['id'] = user.id ?? ''
        // tenantId: null in slice 4.1; resolved in slice 4.5 when middleware parses slug
        token['tenantId'] = null
      }
      return token
    },
    session({ session, token }) {
      session.user.id = String(token['id'] ?? '')
      session.user.tenantId = (token['tenantId'] as string | null) ?? null
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(config)
