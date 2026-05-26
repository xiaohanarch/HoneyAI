'use client'
// useSSE: connects EventSource to /api/runs/[runId]/stream and dispatches
// incoming events into the Zustand RunStore.
// Handles cleanup on unmount and error reconnect.

import { useEffect } from 'react'
import { useRunStore } from './store'

export type SseEvent =
  | {
      type: 'node_status'
      nodeId: string
      nodeName: string
      nodeKind: string
      nodeStage: number
      status: string
      ts: number
    }
  | { type: 'run_status'; status: string; ts: number }
  | { type: 'error'; message: string; ts: number }

export function useSSE(runId: string) {
  const upsertNode = useRunStore((s) => s.upsertNode)
  const setRunStatus = useRunStore((s) => s.setRunStatus)

  useEffect(() => {
    const es = new EventSource(`/api/runs/${runId}/stream`)

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as SseEvent
        if (data.type === 'node_status') {
          upsertNode(runId, {
            id: data.nodeId,
            name: data.nodeName,
            kind: data.nodeKind as never,
            status: data.status as never,
            stage: data.nodeStage,
          })
        } else if (data.type === 'run_status') {
          setRunStatus(runId, data.status as never)
        }
      } catch {
        // ignore parse errors
      }
    }

    return () => es.close()
  }, [runId, upsertNode, setRunStatus])
}
