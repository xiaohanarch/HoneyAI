import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { tsCols } from './_helpers'
import { runs } from './runs'

export const sandboxStatusEnum = pgEnum('sandbox_status', [
  'pending',
  'running',
  'terminated',
  'failed',
])

export const sandboxes = pgTable('sandboxes', {
  id: uuid('id').primaryKey(),
  runId: uuid('run_id')
    .notNull()
    .references(() => runs.id, { onDelete: 'cascade' })
    .unique(),
  namespace: text('namespace').notNull().default('honeyai'),
  jobName: text('job_name').notNull(),
  podName: text('pod_name'),
  imageDigest: text('image_digest').notNull(),
  resourceCpu: text('resource_cpu').notNull().default('2'),
  resourceMemory: text('resource_memory').notNull().default('2Gi'),
  resourceStorage: text('resource_storage').notNull().default('5Gi'),
  status: sandboxStatusEnum('status').notNull().default('pending'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  terminatedAt: timestamp('terminated_at', { withTimezone: true }),
  ...tsCols,
})

export const sandboxCredentials = pgTable('sandbox_credentials', {
  id: uuid('id').primaryKey(),
  sandboxId: uuid('sandbox_id')
    .notNull()
    .references(() => sandboxes.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['github_token', 'anthropic_key', 'user_secret'] }).notNull(),
  encryptedValue: text('encrypted_value').notNull(),
  dekId: uuid('dek_id').notNull(),
  injectedAt: timestamp('injected_at', { withTimezone: true }).notNull().defaultNow(),
  redactedAt: timestamp('redacted_at', { withTimezone: true }),
})

import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
export const insertSandboxesSchema = createInsertSchema(sandboxes)
export const selectSandboxesSchema = createSelectSchema(sandboxes)
export const insertSandboxCredentialsSchema = createInsertSchema(sandboxCredentials)
export const selectSandboxCredentialsSchema = createSelectSchema(sandboxCredentials)
