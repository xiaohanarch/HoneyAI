import { cn } from '@/lib/utils'
import type { NodeStatus, NodeKind } from '@/lib/runs/store'

type Props = { status: NodeStatus; kind: NodeKind }

const STATUS_CONFIG: Record<NodeStatus, { dot: string; pulse: boolean }> = {
  pending: { dot: 'bg-[var(--status-idle-soft)]', pulse: false },
  running: { dot: 'bg-[var(--status-run)]', pulse: true },
  success: { dot: 'bg-[var(--status-done)]', pulse: false },
  failed: { dot: 'bg-[var(--status-halt)]', pulse: false },
  skipped: { dot: 'bg-[var(--text-faint)]', pulse: false },
}

export function NodeStatusIcon({ status, kind }: Props) {
  const { dot, pulse } = STATUS_CONFIG[status]
  const isGate = kind === 'gate'

  return (
    <span
      aria-label={status}
      className={cn(
        'inline-flex h-3 w-3 flex-shrink-0 rounded-full',
        isGate && 'rounded-none rotate-45',
        dot,
        pulse && 'pulse-run',
      )}
    />
  )
}
