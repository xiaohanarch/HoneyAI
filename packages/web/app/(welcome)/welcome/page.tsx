import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getTenantBootstrap } from '@/lib/bootstrap/read'

export default async function WelcomeIndexPage() {
  const session = await auth()
  if (!session?.user?.tenantId) redirect('/login')

  const r = await getTenantBootstrap(session.user.tenantId)
  if (r?.bootstrap?.completedAt) redirect(`/t/${r.slug}`)

  // Resume from earliest unfinished step
  const b = r?.bootstrap
  if (!b?.anthropicKeyCiphertext) redirect('/welcome/step/1')
  if (!b.githubAppInstalled) redirect('/welcome/step/2')
  if (!b.pendingRepoOwnerName) redirect('/welcome/step/3')
  redirect('/welcome/step/4')
}
