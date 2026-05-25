import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { tenants, users } from './identity'

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    action: text('action').notNull(),
    targetKind: text('target_kind').notNull(),
    targetId: text('target_id').notNull(),
    payload: jsonb('payload').notNull().default({}),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byTenantTime: index('audit_by_tenant_time').on(t.tenantId, t.occurredAt.desc()),
    byOccurredBrin: index('audit_occurred_brin').using('brin', t.occurredAt),
  }),
)

export const activityFeed = pgTable('activity_feed', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  verb: text('verb').notNull(),
  objectKind: text('object_kind').notNull(),
  objectId: text('object_id').notNull(),
  summary: text('summary').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
})
