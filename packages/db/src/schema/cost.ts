import {
  bigint,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { tsCols } from './_helpers'
import { tenants } from './identity'
import { runs } from './runs'
import { nodes } from './runs'

export const costKindEnum = pgEnum('cost_kind', [
  'llm_tokens',
  'github_api',
  'sandbox_compute',
  'storage_write',
  'storage_stored',
  'egress_bytes',
])

export const pricingBook = pgTable(
  'pricing_book',
  {
    id: uuid('id').primaryKey(),
    kind: costKindEnum('kind').notNull(),
    provider: text('provider').notNull(),
    sku: text('sku').notNull(),
    unitCostMicroUsd: bigint('unit_cost_micro_usd', { mode: 'bigint' }).notNull(),
    unit: text('unit').notNull(),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    ...tsCols,
  },
  (t) => ({
    bySku: uniqueIndex('pricing_uniq_active').on(t.kind, t.provider, t.sku, t.effectiveFrom),
  }),
)

export const costEvents = pgTable(
  'cost_events',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    runId: uuid('run_id').references(() => runs.id, { onDelete: 'set null' }),
    nodeId: uuid('node_id').references(() => nodes.id, { onDelete: 'set null' }),
    kind: costKindEnum('kind').notNull(),
    provider: text('provider').notNull(),
    sku: text('sku').notNull(),
    quantity: numeric('quantity', { precision: 20, scale: 4 }).notNull(),
    unitCostMicroUsd: bigint('unit_cost_micro_usd', { mode: 'bigint' }).notNull(),
    totalMicroUsd: bigint('total_micro_usd', { mode: 'bigint' }).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').notNull().default({}),
  },
  (t) => ({
    byTenantOccurred: index('cost_events_by_tenant_time').on(t.tenantId, t.occurredAt.desc()),
    byRun: index('cost_events_by_run').on(t.runId),
    byOccurredBrin: index('cost_events_occurred_brin').using('brin', t.occurredAt),
  }),
)

import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
export const insertPricingBookSchema = createInsertSchema(pricingBook)
export const selectPricingBookSchema = createSelectSchema(pricingBook)
export const insertCostEventsSchema = createInsertSchema(costEvents)
export const selectCostEventsSchema = createSelectSchema(costEvents)
