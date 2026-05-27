import { redirect } from 'next/navigation'
import { getTenantBootstrap } from './read'

// Note: next/navigation's `redirect()` aborts the RSC render by throwing an
// internal NEXT_REDIRECT error — it never returns. Guards therefore exit via
// exception, not via the declared Promise<void> resolution path.

export async function requireBootstrapComplete(tenantId: string): Promise<void> {
  const r = await getTenantBootstrap(tenantId)
  if (!r || !r.bootstrap?.completedAt) redirect('/welcome')
}

export async function requireBootstrapIncomplete(tenantId: string): Promise<void> {
  const r = await getTenantBootstrap(tenantId)
  if (r?.bootstrap?.completedAt) redirect('/prototype/index.html')
}
