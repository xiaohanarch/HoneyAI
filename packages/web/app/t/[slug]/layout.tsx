import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { requireBootstrapComplete } from '@/lib/bootstrap/guard'
import { getTenantBootstrap } from '@/lib/bootstrap/read'

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const session = await auth()
  if (!session?.user?.tenantId) redirect('/login')
  await requireBootstrapComplete(session.user.tenantId)

  // Second read for slug resolution. React cache() deduplicates within the RSC
  // pass in production. The notFound() guard is defensive: requireBootstrapComplete
  // above would have redirected if the row were absent, so this path only fires
  // on data-consistency anomalies (e.g. row deleted between the two reads).
  const r = await getTenantBootstrap(session.user.tenantId)
  if (!r) notFound()
  if (r.slug !== slug) redirect(`/t/${r.slug}`) // AC-01-12: slug mismatch → canonical slug

  return <>{children}</>
}
