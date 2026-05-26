// packages/web/lib/auth/types.ts
// NextAuth v5 module augmentation — adds userId and tenantId to Session + JWT.
// See: https://authjs.dev/getting-started/typescript

import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      tenantId: string | null
    } & DefaultSession['user']
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string
    tenantId: string | null
  }
}

export type {}
