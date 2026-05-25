import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { tsCols, softDelete } from './_helpers'
import { tenants, users } from './identity'

export const assetKindEnum = pgEnum('asset_kind', [
  'skill',
  'rule',
  'command',
  'script',
  'hook',
  'hint',
  'template',
  'context',
])
export const assetSyncModeEnum = pgEnum('asset_sync_mode', ['manual', 'mirror', 'import-once'])

export const assetSources = pgTable(
  'asset_sources',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }), // null = 全局
    kind: text('kind', { enum: ['github_repo'] }).notNull(),
    repoUrl: text('repo_url').notNull(),
    subPath: text('sub_path').notNull().default(''),
    syncMode: assetSyncModeEnum('sync_mode').notNull(),
    branch: text('branch').notNull().default('main'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    lastSyncSha: text('last_sync_sha'),
    ...tsCols,
  },
  (t) => ({ byTenant: index('asset_sources_by_tenant').on(t.tenantId) }),
)

export const assets = pgTable(
  'assets',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }), // null = 全局官方
    sourceId: uuid('source_id').references(() => assetSources.id, { onDelete: 'set null' }),
    sourcePath: text('source_path'),
    name: text('name').notNull(),
    kind: assetKindEnum('kind').notNull(),
    description: text('description'),
    currentVersionId: uuid('current_version_id'),
    isEnabled: boolean('is_enabled').notNull().default(true),
    metadata: jsonb('metadata').notNull().default({}),
    ...tsCols,
    ...softDelete,
  },
  (t) => ({
    byTenantKind: index('assets_by_tenant_kind').on(t.tenantId, t.kind),
    uniqName: uniqueIndex('assets_uniq_name').on(t.tenantId, t.kind, t.name),
  }),
)

export const assetVersions = pgTable(
  'asset_versions',
  {
    id: uuid('id').primaryKey(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    content: text('content').notNull(),
    frontmatter: jsonb('frontmatter').notNull().default({}),
    authorUserId: uuid('author_user_id').references(() => users.id),
    authorKind: text('author_kind', { enum: ['user', 'mirror_sync', 'system_seed'] }).notNull(),
    ...tsCols,
  },
  (t) => ({
    byAsset: index('asset_versions_by_asset').on(t.assetId, t.version),
    uniqVersion: uniqueIndex('asset_versions_uniq').on(t.assetId, t.version),
  }),
)
