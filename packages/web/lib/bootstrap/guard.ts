import { redirect } from 'next/navigation'
import { getTenantBootstrap } from './read'

export async function requireBootstrapComplete(tenantId: string): Promise<void> {
  const r = await getTenantBootstrap(tenantId)
  if (!r || !r.bootstrap?.completedAt) redirect('/welcome')
}

export async function requireBootstrapIncomplete(tenantId: string): Promise<void> {
  const r = await getTenantBootstrap(tenantId)
  if (r?.bootstrap?.completedAt) redirect(`/t/${r.slug}`)
}
