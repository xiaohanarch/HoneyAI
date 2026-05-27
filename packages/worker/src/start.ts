// Worker process entry point.
// Run with: tsx src/start.ts
// This file owns all startup side-effects; index.ts stays as a pure barrel.

import { Worker } from 'bullmq'
import { getDb } from '@honeyai/db'
import { startReconcileLoop } from '@honeyai/orchestrator'
import type { PodChecker } from '@honeyai/orchestrator'
import { ClaudeCodeAdapter } from '@honeyai/adapter-claude'
import { initGitHubApp } from '@honeyai/github'
import { handleScheduleRun } from './handlers/schedule-run.js'
import { handleAdvanceRun } from './handlers/advance-run.js'
import { getArtifactContent } from './handlers/artifact-content.js'
import { resolveAndCreatePR } from './handlers/github-pr.js'
import { SCHEDULE_RUN_QUEUE, ADVANCE_RUN_QUEUE } from './queues.js'
import { runCostRollup } from './cost-rollup.js'
import type { ScheduleRunJob, AdvanceRunJob } from './queues.js'

// ─── Fail-fast env check ──────────────────────────────────────────────────────

const DATABASE_URL = process.env['DATABASE_URL']
const REDIS_URL = process.env['REDIS_URL']
const ANTHROPIC_API_KEY = process.env['ANTHROPIC_API_KEY']

if (!DATABASE_URL) throw new Error('DATABASE_URL is required')
if (!REDIS_URL) throw new Error('REDIS_URL is required')
if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is required')

// ─── Optional GitHub App configuration ───────────────────────────────────────

const GITHUB_APP_ID = process.env['GITHUB_APP_ID']
const GITHUB_APP_PRIVATE_KEY = process.env['GITHUB_APP_PRIVATE_KEY']
const GITHUB_CLIENT_ID = process.env['GITHUB_CLIENT_ID']
const GITHUB_CLIENT_SECRET = process.env['GITHUB_CLIENT_SECRET']

const githubConfigured =
  Boolean(GITHUB_APP_ID) &&
  Boolean(GITHUB_APP_PRIVATE_KEY) &&
  Boolean(GITHUB_CLIENT_ID) &&
  Boolean(GITHUB_CLIENT_SECRET)

if (githubConfigured) {
  initGitHubApp({
    appId: GITHUB_APP_ID!,
    privateKey: GITHUB_APP_PRIVATE_KEY!,
    clientId: GITHUB_CLIENT_ID!,
    clientSecret: GITHUB_CLIENT_SECRET!,
  })
} else {
  console.warn('[worker] GitHub App env vars not fully configured — createPR will be a no-op')
}

// ─── Infrastructure ───────────────────────────────────────────────────────────

// Pass plain connection options to avoid ioredis version mismatch with BullMQ's peer dep.
const redisOpts = { url: REDIS_URL, maxRetriesPerRequest: null } as const
const db = getDb()

// ─── BullMQ Workers ───────────────────────────────────────────────────────────

const claudeAdapter = new ClaudeCodeAdapter()

const scheduleWorker = new Worker<ScheduleRunJob>(
  SCHEDULE_RUN_QUEUE,
  async (job) => {
    await handleScheduleRun(
      {
        db,
        adapter: claudeAdapter,
        anthropicKey: ANTHROPIC_API_KEY,
      },
      job.data,
    )
  },
  { connection: redisOpts },
)

const advanceWorker = new Worker<AdvanceRunJob>(
  ADVANCE_RUN_QUEUE,
  async (job) => {
    await handleAdvanceRun(
      {
        db,
        adapter: claudeAdapter,
        anthropicKey: ANTHROPIC_API_KEY,
        createPR: async (params) => {
          if (!githubConfigured) {
            console.warn('[worker] GitHub App not configured — skipping createPR')
            return { prNumber: 0, prUrl: '', branchName: params.headBranch, sha: '' }
          }
          return resolveAndCreatePR(db, params)
        },
        getArtifactContent: (blobSha256) => getArtifactContent(db, blobSha256),
      },
      job.data,
    )
  },
  { connection: redisOpts },
)

// ─── Reconcile loop ───────────────────────────────────────────────────────────

// PodChecker stub — k8s integration in a future phase
const podChecker: PodChecker = async (_tenantId, _runId) => ({ status: 'not_found' as const })
const stopReconcile = startReconcileLoop(db, podChecker)

// ─── Cost rollup cron (every 5 minutes) ──────────────────────────────────────

const COST_ROLLUP_INTERVAL_MS = 5 * 60 * 1000
const costRollupTimer = setInterval(() => {
  runCostRollup(db).catch((err) => console.warn('[cost-rollup] error:', err))
}, COST_ROLLUP_INTERVAL_MS)

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown(): Promise<void> {
  stopReconcile()
  clearInterval(costRollupTimer)
  await scheduleWorker.close()
  await advanceWorker.close()
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown())
process.on('SIGINT', () => void shutdown())
