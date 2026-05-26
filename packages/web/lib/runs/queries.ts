// RSC-only DB query helpers for the Run Dashboard.
// Do NOT add 'use client' — these run server-side.

import { eq } from 'drizzle-orm'
import { getDb, repos } from '@honeyai/db'
import type { repos as reposType } from '@honeyai/db'
import { nodes, runs } from '@honeyai/db/schema'
import type { NodeState } from './store'

export type Run =
  Awaited<ReturnType<typeof reposType.getRun>> extends infer T
    ? T extends undefined
      ? never
      : T
    : never

export type RunWithNodes = { run: Run; nodes: NodeState[] }

export type ListRunsOptions = { limit?: number; offset?: number }

/**
 * Lists runs for a tenant, newest-first.
 */
export async function listRuns(tenantId: string, opts: ListRunsOptions = {}): Promise<Run[]> {
  const db = getDb()
  return repos.listRunsByTenant(db, tenantId, opts)
}

/**
 * Fetches a run + its nodes in two parallel selects.
 * Returns null if the run does not exist.
 */
export async function getRunWithNodes(runId: string): Promise<RunWithNodes | null> {
  const db = getDb()

  const [runRows, nodeRows] = await Promise.all([
    db.select().from(runs).where(eq(runs.id, runId)).limit(1),
    db.select().from(nodes).where(eq(nodes.runId, runId)),
  ])

  const run = runRows[0]
  if (!run) return null

  const nodeStates: NodeState[] = nodeRows.map((n) => ({
    id: n.id,
    name: n.name,
    kind: n.kind as NodeState['kind'],
    status: n.status as NodeState['status'],
    stage: n.stage,
  }))

  return { run, nodes: nodeStates }
}
