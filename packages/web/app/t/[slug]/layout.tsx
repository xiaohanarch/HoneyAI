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

  const r = await getTenantBootstrap(session.user.tenantId)
  if (!r) notFound()
  if (r.slug !== slug) redirect(`/t/${r.slug}`) // AC-01-12

  return <>{children}</>
}
