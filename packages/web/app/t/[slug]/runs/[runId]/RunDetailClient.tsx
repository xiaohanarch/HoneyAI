'use client'

import { useEffect } from 'react'
import { useRunStore } from '@/lib/runs/store'
import { useSSE } from '@/lib/runs/sse'
import { RunTimeline } from '@/components/run/RunTimeline'
import { GatePanel } from '@/components/run/GatePanel'
import type { NodeState, RunStatus } from '@/lib/runs/store'

type Props = {
  runId: string
  tenantSlug: string
  initialStatus: RunStatus
  initialNodes: NodeState[]
}

export function RunDetailClient({ runId, tenantSlug, initialStatus, initialNodes }: Props) {
  const initRun = useRunStore((s) => s.initRun)
  const runStatus = useRunStore((s) => s.runs[runId]?.status ?? initialStatus)

  // Seed store with server-fetched initial data (runs once on mount)
  useEffect(() => {
    initRun(runId, initialStatus, initialNodes)
  }, [runId, initialStatus, initialNodes, initRun])

  // Subscribe to SSE stream for live updates
  useSSE(runId)

  const isPausedAtGate = runStatus === 'paused_at_gate'

  // Find the active gate node (kind=gate, status=running)
  const gateNode = useRunStore((s) =>
    s.runs[runId]?.nodes.find((n) => n.kind === 'gate' && n.status === 'running'),
  )

  return (
    <div className="flex flex-col gap-4">
      <RunTimeline runId={runId} />
      {isPausedAtGate && gateNode && (
        <GatePanel runId={runId} nodeId={gateNode.id} tenantSlug={tenantSlug} />
      )}
    </div>
  )
}
