import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { tsCols } from './_helpers'
import { assetSources } from './assets'

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey(),
  queueName: text('queue_name').notNull(),
  bullJobId: text('bull_job_id').notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status', { enum: ['queued', 'active', 'completed', 'failed'] }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  enqueuedAt: timestamp('enqueued_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
})

export const jobLocks = pgTable('job_locks', {
  lockKey: text('lock_key').primaryKey(),
  ownerJobId: uuid('owner_job_id'),
  acquiredAt: timestamp('acquired_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})

export const assetSyncQueue = pgTable('asset_sync_queue', {
  id: uuid('id').primaryKey(),
  sourceId: uuid('source_id')
    .notNull()
    .references(() => assetSources.id, { onDelete: 'cascade' }),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  status: text('status', { enum: ['queued', 'running', 'done', 'failed'] })
    .notNull()
    .default('queued'),
  lastResult: jsonb('last_result'),
  ...tsCols,
})
