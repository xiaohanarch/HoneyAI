'use client'
// Zustand store for SSE-driven run node states.
// Isolated to client components only — never imported from RSC.

import { create } from 'zustand'

export type NodeStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped'
export type NodeKind = 'agent' | 'gate' | 'merge' | 'deploy'
export type RunStatus =
  | 'created'
  | 'scheduling'
  | 'running'
  | 'paused_at_gate'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type NodeState = {
  id: string
  name: string
  kind: NodeKind
  status: NodeStatus
  stage: number
}

export type RunState = {
  runId: string
  status: RunStatus
  nodes: NodeState[]
}

type RunStoreState = {
  runs: Record<string, RunState>
  setRunStatus: (runId: string, status: RunStatus) => void
  upsertNode: (runId: string, node: NodeState) => void
  initRun: (runId: string, status: RunStatus, nodes: NodeState[]) => void
}

export const useRunStore = create<RunStoreState>((set) => ({
  runs: {},
  setRunStatus: (runId, status) =>
    set((s) => ({
      runs: {
        ...s.runs,
        [runId]: { ...s.runs[runId], runId, status, nodes: s.runs[runId]?.nodes ?? [] },
      },
    })),
  upsertNode: (runId, node) =>
    set((s) => {
      const existing = s.runs[runId]
      const nodes = existing?.nodes ?? []
      const idx = nodes.findIndex((n) => n.id === node.id)
      const newNodes = idx >= 0 ? nodes.map((n, i) => (i === idx ? node : n)) : [...nodes, node]
      return {
        runs: {
          ...s.runs,
          [runId]: { runId, status: existing?.status ?? 'running', nodes: newNodes },
        },
      }
    }),
  initRun: (runId, status, nodes) =>
    set((s) => ({
      runs: { ...s.runs, [runId]: { runId, status, nodes } },
    })),
}))
