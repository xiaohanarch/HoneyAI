import { cn } from '@/lib/utils'
import { zhRuns } from '@/lib/strings/zh'
import type { RunStatus } from '@/lib/runs/store'

type Props = { status: RunStatus; className?: string }

const STATUS_STYLE: Record<RunStatus, string> = {
  created: 'bg-[var(--status-idle-soft)] text-[var(--text-muted)]',
  scheduling: 'bg-[var(--status-idle-soft)] text-[var(--text-muted)]',
  running: 'bg-[var(--status-run)] text-white',
  paused_at_gate: 'bg-[var(--status-review)] text-white',
  completed: 'bg-[var(--status-done)] text-white',
  failed: 'bg-[var(--status-halt)] text-white',
  cancelled: 'bg-[var(--text-faint)] text-white',
}

export function RunStatusBadge({ status, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        STATUS_STYLE[status],
        className,
      )}
    >
      {zhRuns.status[status]}
    </span>
  )
}
