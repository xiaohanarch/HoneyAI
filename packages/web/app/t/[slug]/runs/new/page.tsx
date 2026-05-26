import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { zhRuns } from '@/lib/strings/zh'
import { NewRunForm } from './NewRunForm'

export default async function NewRunPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await auth()
  if (!session?.user?.tenantId) redirect('/login')

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-6 text-2xl font-semibold text-[var(--text-strong)]">
        {zhRuns.new.heading}
      </h1>
      <NewRunForm tenantSlug={slug} />
    </div>
  )
}
