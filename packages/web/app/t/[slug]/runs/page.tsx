import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { listRuns } from '@/lib/runs/queries'
import { RunStatusBadge } from '@/components/run/RunStatusBadge'
import { zhRuns } from '@/lib/strings/zh'

export default async function RunsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await auth()
  if (!session?.user?.tenantId) redirect('/login')

  const runs = await listRuns(session.user.tenantId)

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--text-strong)]">{zhRuns.list.heading}</h1>
        <Link
          href={`/t/${slug}/runs/new`}
          className="rounded-[var(--r-md)] bg-[var(--status-run)] px-4 py-2 text-sm font-medium text-white"
        >
          {zhRuns.list.newRun}
        </Link>
      </div>

      {runs.length === 0 ? (
        <p className="text-[var(--text-muted)]">{zhRuns.list.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {runs.map((run) => (
            <li key={run.id}>
              <Link
                href={`/t/${slug}/runs/${run.id}`}
                className="flex items-center justify-between rounded-[var(--r-lg)] border bg-[var(--bg-card)] p-4"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-[var(--text-strong)]">{run.title}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {run.createdAt.toLocaleString('zh-CN')}
                  </span>
                </div>
                <RunStatusBadge status={run.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
