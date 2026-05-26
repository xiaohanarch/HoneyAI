import {
  bigint,
  boolean,
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
import { tsCols, softDelete } from './_helpers'

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  githubId: bigint('github_id', { mode: 'number' }).notNull().unique(),
  githubLogin: text('github_login').notNull(),
  email: text('email'),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  isPlatformAdmin: boolean('is_platform_admin').notNull().default(false),
  ...tsCols,
})

// Auth.js v5 DrizzleAdapter
export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    expiresAt: integer('expires_at'),
    tokenType: text('token_type'),
    scope: text('scope'),
    idToken: text('id_token'),
    sessionState: text('session_state'),
  },
  (t) => ({ pk: primaryKey({ columns: [t.provider, t.providerAccountId] }) }),
)

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
})

export type TenantBootstrapState = {
  anthropicKeyCiphertext?: string
  githubAppInstalled?: boolean
  githubAppMarkedAt?: string
  pendingRepoOwnerName?: string
  defaultSkillsApplied?: 'skipped' | 'imported'
  completedAt?: string
}

export type TenantSettings = {
  bootstrap?: TenantBootstrapState
}

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  kind: text('kind', { enum: ['personal', 'team'] })
    .notNull()
    .default('personal'),
  defaultRepoId: uuid('default_repo_id'),
  budgetMicroUsdMonthly: bigint('budget_micro_usd_monthly', { mode: 'bigint' }),
  settings: jsonb('settings').$type<TenantSettings>().notNull().default({}),
  ...tsCols,
  ...softDelete,
})

export const tenantRoleEnum = pgEnum('tenant_role', ['owner', 'member'])

export const tenantMembers = pgTable(
  'tenant_members',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: tenantRoleEnum('role').notNull().default('member'),
    invitedBy: uuid('invited_by').references(() => users.id),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tenantId, t.userId] }),
    byUser: index('tenant_members_by_user').on(t.userId),
  }),
)

import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
export const insertUsersSchema = createInsertSchema(users)
export const selectUsersSchema = createSelectSchema(users)
export const insertAccountsSchema = createInsertSchema(accounts)
export const selectAccountsSchema = createSelectSchema(accounts)
export const insertSessionsSchema = createInsertSchema(sessions)
export const selectSessionsSchema = createSelectSchema(sessions)
export const insertTenantsSchema = createInsertSchema(tenants)
export const selectTenantsSchema = createSelectSchema(tenants)
export const insertTenantMembersSchema = createInsertSchema(tenantMembers)
export const selectTenantMembersSchema = createSelectSchema(tenantMembers)
