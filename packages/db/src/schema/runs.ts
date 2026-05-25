import { sql } from 'drizzle-orm'
import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { tsCols } from './_helpers'
import { tenants, users } from './identity'
import { repositories } from './github'

export const runStatusEnum = pgEnum('run_status', [
  'created',
  'scheduling',
  'running',
  'paused_at_gate',
  'completed',
  'failed',
  'cancelled',
])
export const nodeStatusEnum = pgEnum('node_status', [
  'pending',
  'running',
  'success',
  'failed',
  'skipped',
])
export const nodeKindEnum = pgEnum('node_kind', ['agent', 'gate', 'merge', 'deploy'])
export const failureClassEnum = pgEnum('failure_class', [
  'llm_rate_limited',
  'llm_quality_failed',
  'sandbox_timeout',
  'sandbox_oom',
  'sandbox_died',
  'sandbox_disk_full',
  'external_failed',
  'user_cancelled',
])

export const runs = pgTable(
  'runs',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    repositoryId: uuid('repository_id')
      .notNull()
      .references(() => repositories.id),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    oneLiner: text('one_liner').notNull(),
    targetBranch: text('target_branch').notNull().default('main'),
    status: runStatusEnum('status').notNull().default('created'),
    failureClass: failureClassEnum('failure_class'),
    failureMessage: text('failure_message'),
    runtime: text('runtime', { enum: ['claude_code', 'opencode'] })
      .notNull()
      .default('claude_code'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    totalCostMicroUsd: bigint('total_cost_micro_usd', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    ...tsCols,
  },
  (t) => ({
    byTenantCreated: index('runs_by_tenant_created').on(t.tenantId, t.createdAt.desc()),
    byStatus: index('runs_by_status').on(t.tenantId, t.status),
  }),
)

export const nodes = pgTable(
  'nodes',
  {
    id: uuid('id').primaryKey(),
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    parentNodeId: uuid('parent_node_id').references((): AnyPgColumn => nodes.id),
    stage: integer('stage').notNull(),
    ordinal: integer('ordinal').notNull(),
    name: text('name').notNull(),
    kind: nodeKindEnum('kind').notNull(),
    status: nodeStatusEnum('status').notNull().default('pending'),
    retryCount: integer('retry_count').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    config: jsonb('config').notNull().default({}),
    ...tsCols,
  },
  (t) => ({
    byRun: index('nodes_by_run').on(t.runId, t.ordinal),
  }),
)

export const gates = pgTable('gates', {
  nodeId: uuid('node_id')
    .notNull()
    .references(() => nodes.id, { onDelete: 'cascade' })
    .primaryKey(),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  passedAt: timestamp('passed_at', { withTimezone: true }),
  passedByUserId: uuid('passed_by_user_id').references(() => users.id),
  pinnedArtifactId: uuid('pinned_artifact_id'),
  viewedAt: timestamp('viewed_at', { withTimezone: true }),
})

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey(),
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    nodeId: uuid('node_id').references(() => nodes.id, { onDelete: 'cascade' }),
    seq: bigint('seq', { mode: 'bigint' }).notNull(),
    kind: text('kind').notNull(),
    payload: jsonb('payload').notNull(),
    traceId: text('trace_id'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byRunSeq: index('events_by_run_seq').on(t.runId, t.seq),
    byOccurredBrin: index('events_occurred_brin').using('brin', t.occurredAt),
  }),
)

export const nodeRetries = pgTable('node_retries', {
  id: uuid('id').primaryKey(),
  nodeId: uuid('node_id')
    .notNull()
    .references(() => nodes.id, { onDelete: 'cascade' }),
  attempt: integer('attempt').notNull(),
  trigger: text('trigger', { enum: ['auto', 'manual'] }).notNull(),
  triggeredByUserId: uuid('triggered_by_user_id').references(() => users.id),
  failureClass: failureClassEnum('failure_class'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  configOverride: jsonb('config_override').notNull().default({}),
})
