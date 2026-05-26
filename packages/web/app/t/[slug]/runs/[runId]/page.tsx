import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getRunWithNodes } from '@/lib/runs/queries'
import { RunStatusBadge } from '@/components/run/RunStatusBadge'
import { RunDetailClient } from './RunDetailClient'

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ slug: string; runId: string }>
}) {
  const { slug, runId } = await params
  const session = await auth()
  if (!session?.user?.tenantId) redirect('/login')

  const data = await getRunWithNodes(runId)
  if (!data) notFound()

  const { run, nodes } = data

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">{run.title}</h1>
          <p className="text-sm text-[var(--text-muted)]">{run.oneLiner}</p>
        </div>
        <RunStatusBadge status={run.status} />
      </div>

      {/* Client shell: SSE + timeline + gate */}
      <RunDetailClient
        runId={run.id}
        tenantSlug={slug}
        initialStatus={run.status}
        initialNodes={nodes}
      />
    </div>
  )
}
