// packages/web/app/api/auth/[...nextauth]/route.ts
// NextAuth v5 catch-all route handler — delegates to lib/auth.
import { handlers } from '@/lib/auth/index.js'

export const { GET, POST } = handlers
