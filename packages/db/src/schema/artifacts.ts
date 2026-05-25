import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { tsCols } from './_helpers'
import { tenants, users } from './identity'
import { runs, nodes } from './runs'

export const artifactKindEnum = pgEnum('artifact_kind', [
  'requirement_ir',
  'design_ir',
  'design_sub_ir',
  'impl_ir',
  'pr_meta',
  'log_chunk',
  'raw_input',
])
export const artifactStatusEnum = pgEnum('artifact_status', ['ok', 'failed'])

// CAS 物理层（sha256 去重），不可变
export const artifactBlobs = pgTable('artifact_blobs', {
  sha256: text('sha256').primaryKey(),
  byteSize: bigint('byte_size', { mode: 'bigint' }).notNull(),
  ossKey: text('oss_key').notNull().unique(),
  contentType: text('content_type').notNull().default('text/markdown'),
  ...tsCols,
})

// 逻辑层（每次 attempt 一行），不可变；通过 blob_sha256 引用物理 blob
export const artifacts = pgTable(
  'artifacts',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    nodeId: uuid('node_id').references(() => nodes.id, { onDelete: 'set null' }),
    attempt: integer('attempt').notNull().default(1),
    kind: artifactKindEnum('kind').notNull(),
    status: artifactStatusEnum('status').notNull().default('ok'),
    blobSha256: text('blob_sha256')
      .notNull()
      .references(() => artifactBlobs.sha256),
    metadata: jsonb('metadata').notNull().default({}),
    authorKind: text('author_kind', { enum: ['agent', 'user', 'system'] }).notNull(),
    authorUserId: uuid('author_user_id').references(() => users.id),
    pinned: boolean('pinned').notNull().default(false),
    ...tsCols,
  },
  (t) => ({
    byRunKind: index('artifacts_by_run_kind').on(t.runId, t.kind, t.attempt.desc()),
    byTenantCreated: index('artifacts_by_tenant_created').on(t.tenantId, t.createdAt.desc()),
    uniqByNodeAttempt: uniqueIndex('artifacts_uniq_node_attempt_kind').on(
      t.runId,
      t.nodeId,
      t.attempt,
      t.kind,
    ),
  }),
)

import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
export const insertArtifactBlobsSchema = createInsertSchema(artifactBlobs)
export const selectArtifactBlobsSchema = createSelectSchema(artifactBlobs)
export const insertArtifactsSchema = createInsertSchema(artifacts)
export const selectArtifactsSchema = createSelectSchema(artifacts)
