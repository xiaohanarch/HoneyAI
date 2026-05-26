// packages/web/app/(welcome)/layout.tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { requireBootstrapIncomplete } from '@/lib/bootstrap/guard'

export default async function WelcomeLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.tenantId) redirect('/login')
  await requireBootstrapIncomplete(session.user.tenantId)
  return <div className="min-h-screen bg-atmosphere p-8">{children}</div>
}
