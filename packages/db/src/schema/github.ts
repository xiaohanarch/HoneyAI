import {
  bigint,
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { tsCols } from './_helpers'
import { tenants, users } from './identity'

export const githubInstallations = pgTable('github_installations', {
  id: uuid('id').primaryKey(),
  installationId: bigint('installation_id', { mode: 'number' }).notNull().unique(),
  accountLogin: text('account_login').notNull(),
  accountType: text('account_type', { enum: ['User', 'Organization'] }).notNull(),
  installedByUserId: uuid('installed_by_user_id').references(() => users.id),
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  ...tsCols,
})

export const repositories = pgTable(
  'repositories',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    installationId: uuid('installation_id')
      .notNull()
      .references(() => githubInstallations.id),
    githubRepoId: bigint('github_repo_id', { mode: 'number' }).notNull(),
    owner: text('owner').notNull(),
    name: text('name').notNull(),
    defaultBranch: text('default_branch').notNull().default('main'),
    isEnabled: boolean('is_enabled').notNull().default(true),
    ...tsCols,
  },
  (t) => ({
    byTenant: index('repos_by_tenant').on(t.tenantId),
    uniqGithub: uniqueIndex('repos_uniq_github').on(t.tenantId, t.githubRepoId),
  }),
)

export const githubTokens = pgTable('github_tokens', {
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .primaryKey(),
  encryptedToken: text('encrypted_token').notNull(),
  dekId: uuid('dek_id').notNull(),
  scope: text('scope').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  ...tsCols,
})
