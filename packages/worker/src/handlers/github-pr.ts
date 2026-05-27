// packages/worker/src/handlers/github-pr.ts
// Resolves GitHub installation from DB and delegates to createPR from @honeyai/github.

import { eq, and } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '@honeyai/db/schema'
import { createAppClient, createPR as createGithubPR } from '@honeyai/github'
import type { PRResult } from '@honeyai/github'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = NodePgDatabase<any>

export type CreatePRFnParams = {
  owner: string
  repo: string
  baseBranch: string
  headBranch: string
  title: string
  files: Array<{ path: string; content: string }>
  runId: string
  stageSummary: string
}

/**
 * Look up the repo + GitHub installation in DB, obtain an installation-scoped
 * Octokit client, then delegate to createPR from @honeyai/github.
 */
export async function resolveAndCreatePR(db: AnyDb, params: CreatePRFnParams): Promise<PRResult> {
  // 1. Find repo by owner + name
  const repoRows = await db
    .select()
    .from(schema.repositories)
    .where(
      and(eq(schema.repositories.owner, params.owner), eq(schema.repositories.name, params.repo)),
    )

  const repo = repoRows[0]
  if (!repo) {
    throw new Error(`createPR: repository not found: ${params.owner}/${params.repo}`)
  }

  // 2. Find GitHub installation by UUID FK
  const installRows = await db
    .select()
    .from(schema.githubInstallations)
    .where(eq(schema.githubInstallations.id, repo.installationId))

  const installation = installRows[0]
  if (!installation) {
    throw new Error(`createPR: installation not found for repo ${params.owner}/${params.repo}`)
  }

  // 3. Obtain installation-scoped Octokit (installationId is the numeric GitHub App installation ID)
  const octokit = await createAppClient(installation.installationId)

  // 4. Delegate to @honeyai/github createPR
  return createGithubPR({ ...params, octokit })
}
