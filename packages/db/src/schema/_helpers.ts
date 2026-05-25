import { timestamp } from 'drizzle-orm/pg-core'

export const tsCols = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

export const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}
