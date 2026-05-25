import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { tenants, users } from './identity'
import { runs } from './runs'

// IR markdown 不落 OSS，TEXT 列直存；每次 save 写新版本行（append-only INSERT）
export const irStageEnum = pgEnum('ir_stage', ['requirement', 'design', 'implementation'])

export const irDocuments = pgTable(
  'ir_documents',
  {
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    stage: irStageEnum('stage').notNull(),
    version: integer('version').notNull(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    frontmatterJson: jsonb('frontmatter_json').notNull(),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    createdByKind: text('created_by_kind', { enum: ['agent', 'user'] }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.runId, t.stage, t.version] }),
    byCurrent: index('ir_documents_by_current').on(t.runId, t.stage, t.version.desc()),
    byTenant: index('ir_documents_by_tenant_created').on(t.tenantId, t.createdAt.desc()),
  }),
)

import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
export const insertIrDocumentsSchema = createInsertSchema(irDocuments)
export const selectIrDocumentsSchema = createSelectSchema(irDocuments)
