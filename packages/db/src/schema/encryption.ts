import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { tsCols } from './_helpers'

export const dataEncryptionKeys = pgTable('data_encryption_keys', {
  id: uuid('id').primaryKey(),
  kekVersion: integer('kek_version').notNull(),
  encryptedDek: text('encrypted_dek').notNull(),
  algorithm: text('algorithm').notNull().default('AES-256-GCM'),
  ...tsCols,
  rotatedAt: timestamp('rotated_at', { withTimezone: true }),
})

import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
export const insertDataEncryptionKeysSchema = createInsertSchema(dataEncryptionKeys)
export const selectDataEncryptionKeysSchema = createSelectSchema(dataEncryptionKeys)
