'use client'

import { useRunStore } from '@/lib/runs/store'
import { NodeStatusIcon } from '@/components/run/NodeStatusIcon'
import { cn } from '@/lib/utils'

import type { NodeState } from '@/lib/runs/store'

type Props = { runId: string }

const EMPTY_NODES: NodeState[] = []

export function RunTimeline({ runId }: Props) {
  const nodes = useRunStore((s) => s.runs[runId]?.nodes ?? EMPTY_NODES)

  return (
    <ol className="flex flex-col gap-2 p-4">
      {nodes.map((n) => (
        <li key={n.id} className="flex items-center gap-3">
          <NodeStatusIcon status={n.status} kind={n.kind} />
          <span
            className={cn(
              'font-mono text-sm',
              n.status === 'failed' && 'text-[var(--status-halt)]',
              n.status === 'success' && 'text-[var(--status-done)]',
            )}
          >
            {n.name}
          </span>
        </li>
      ))}
    </ol>
  )
}
